const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');
const RESTClient = require('./RESTClient');
const FneInflux = require('./FneInflux');

class Server {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.address = this.config.address;
        this.port = this.config.port;

        this.fneInflux = new FneInflux(this.config.influxdb);

        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);

        this.callStates = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();

        this.fetchAndEmitData();
    }

    loadConfig() {
        if (!fs.existsSync(this.configPath)) {
            console.error(`Config file not found: ${this.configPath}`);
            process.exit(1);
        }
        return yaml.parse(fs.readFileSync(this.configPath, 'utf8'));
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.set('view engine', 'ejs');
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.render('index');
        });

        this.app.get('/affiliations', async (req, res) => {
            const affiliations = await this.fetchAffiliationData();
            res.render('affiliations', { affiliations });
        });

        this.app.get('/rids', async (req, res) => {
            const rids = await this.fetchRIDData();
            res.render('rids', { rids });
        });

        this.app.get('/tgids', async (req, res) => {
            const tgids = await this.fetchTGData();
            res.render('tgids', { tgids });
        });

        this.app.get('/rid/query', this.handleRIDQuery.bind(this));
        this.app.put('/rid/add', this.handleRIDAdd.bind(this));
        this.app.put('/rid/delete', this.handleRIDDelete.bind(this));
        this.app.get('/rid/commit', this.handleRIDCommit.bind(this));

        this.app.get('/tg/query', this.handleTGQuery.bind(this));
        this.app.put('/tg/add', this.handleTGAdd.bind(this));
        this.app.put('/tg/delete', this.handleTGDelete.bind(this));
        this.app.get('/tg/commit', this.handleTGCommit.bind(this));
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            socket.on('disconnect', () => {});

            this.fetchAndEmitData().then(data => {
                if (data) {
                    socket.emit('update', data);
                }
            });
        });
    }

    async fetchPeerQueryData() {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/peer/query', {});
            return response.peers || [];
        } catch (error) {
            console.error('Error fetching peer query data:', error);
            return [];
        }
    }

    async fetchAffiliationData() {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/report-affiliations', {});
            return response.affiliations || [];
        } catch (error) {
            console.error('Error fetching affiliation data:', error);
            return [];
        }
    }

    async fetchRIDData() {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/rid/query', {});
            return response.rids || [];
        } catch (error) {
            console.error('Error fetching RID data:', error);
            return [];
        }
    }

    async fetchTGData() {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/tg/query', {});
            return response.tgs || [];
        } catch (error) {
            console.error('Error fetching TG data:', error);
            return [];
        }
    }

    async fetchAndEmitData() {
        const allData = { sites: [], affiliations: [] };

        const peerQueryData = await this.fetchPeerQueryData();
        const channelData = await this.fneInflux.fetchAllChannelData();
        const affiliationData = await this.fetchAffiliationData();

        const controlChannels = peerQueryData.filter(peer => peer.controlChannel === 0 && peer.voiceChannels.length > 0);
        const voiceChannels = peerQueryData.filter(peer => peer.controlChannel !== 0);
        const conventionalChannels = peerQueryData.filter(peer => peer.controlChannel === 0 && peer.voiceChannels.length === 0);

        const controlChannelMap = new Map();

        if (!peerQueryData || !channelData || !affiliationData || peerQueryData.length <= 0 || channelData.sites.length <= 0 || affiliationData.length <= 0) {
            console.error('Error fetching data');
            return;
        }

        controlChannels.forEach(controlChannel => {
            const statusData = channelData.sites.find(site => site.status.peerId == controlChannel.peerId);
            const status = statusData ? statusData.status : null;
            controlChannelMap.set(controlChannel.peerId, {
                identity: controlChannel.config.identity,
                status: status,
                type: 'controlChannel',
                voiceChannels: []
            });
        });

        voiceChannels.forEach(voiceChannel => {
            const controlChannel = controlChannelMap.get(voiceChannel.controlChannel);
            if (controlChannel) {
                const statusData = channelData.sites.find(site => site.status.peerId == voiceChannel.peerId);
                const status = statusData ? statusData.status : null;
                controlChannel.voiceChannels.push({
                    identity: voiceChannel.config.identity,
                    status: status,
                    type: 'voiceChannel'
                });

                if (status) {
                    const callKey = `${voiceChannel.peerId}-${status.lastSrcId}-${status.lastDstId}`;
                    const currentCallState = this.callStates.get(callKey);

                    if (status.tx && status.lastSrcId !== 0 && status.lastDstId !== 0 && !currentCallState) {
                        console.log(`Call started on VC ${voiceChannel.peerId} (Identity: ${voiceChannel.config.identity}), Src: ${status.lastSrcId}, Dst: ${status.lastDstId}`);
                        this.callStates.set(callKey, true);
                    } else if (!status.tx && currentCallState) {
                        console.log(`Call ended on VC ${voiceChannel.peerId} (Identity: ${voiceChannel.config.identity}), Src: ${status.lastSrcId}, Dst: ${status.lastDstId}`);
                        this.callStates.delete(callKey);
                    }
                }
            }
        });

        controlChannelMap.forEach((value, key) => {
            allData.sites.push(value);
        });

        conventionalChannels.forEach(conventionalChannel => {
            const statusData = channelData.sites.find(site => site.status.peerId == conventionalChannel.peerId);
            const status = statusData ? statusData.status : null;
            allData.sites.push({
                identity: conventionalChannel.config.identity,
                status: status,
                type: 'conventional'
            });
        });

        allData.affiliations = affiliationData;

        this.io.emit('update', allData);
    }

    // TODO: Refactor these handlers into a separate class

    async handleRIDQuery(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/rid/query', {});
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching RID data' });
        }
    }

    async handleRIDAdd(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('PUT', '/rid/add', req.body);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error adding RID' });
        }
    }

    async handleRIDDelete(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('PUT', '/rid/delete', req.body);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error deleting RID' });
        }
    }

    async handleRIDCommit(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/rid/commit', {});
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error committing RID changes' });
        }
    }

    async handleTGQuery(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/tg/query', {});
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching TG data' });
        }
    }

    async handleTGAdd(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('PUT', '/tg/add', req.body);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error adding TG' });
        }
    }

    async handleTGDelete(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('PUT', '/tg/delete', req.body);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error deleting TG' });
        }
    }

    async handleTGCommit(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/tg/commit', {});
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error committing TG changes' });
        }
    }

    start() {
        setInterval(() => {
            this.fetchAndEmitData();
        }, 2000);

        this.server.listen(this.port, this.address, () => {
            console.log(`Server is running on http://${this.address}:${this.port}`);
        });
    }
}

module.exports = Server;