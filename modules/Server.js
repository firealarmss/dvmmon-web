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