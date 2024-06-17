const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');
const FneInflux = require('./FneInflux');
const DBManager = require("./DBManager");
const RESTClient = require('./RESTClient');
const RidHanlder = require("./RidHandler");
const TgidHandler = require("./TgidHandler");

class Server {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.address = this.config.address;
        this.port = this.config.port;

        this.fneInflux = new FneInflux(this.config.influxdb);
        this.dbManager = new DBManager(path.join(__dirname, '../db/users.db'));

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
        this.app.use(session({
            secret: 'your_secret_key',
            resave: false,
            saveUninitialized: true
        }));
        this.app.set('view engine', 'ejs');
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.render('index', { user: req.session.user });
        });

        this.app.get('/login', (req, res) => {
            res.render('login');
        });

        this.app.post('/login', (req, res) => {
            const { username, password } = req.body;
            this.dbManager.authenticateUser(username, password, (err, user) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                } else if (!user) {
                    res.status(401).send('Invalid Credentials');
                } else {
                    req.session.user = user;
                    res.redirect('/');
                }
            });
        });

        this.app.get('/logout', (req, res) => {
            req.session.destroy((err) => {
                if (err) console.error(err);
                res.redirect('/login');
            });
        });

        this.app.get('/users', this.checkAuth, (req, res) => {
            this.dbManager.getAllUsers((err, users) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                } else {
                    res.render('users', { users, user: req.session.user });
                }
            });
        });

        this.app.post('/users', this.checkAuth, (req, res) => {
            const { username, password } = req.body;
            this.dbManager.createUser(username, password, (err) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                } else {
                    res.redirect('/users');
                }
            });
        });

        this.app.delete('/users/:id', this.checkAuth, (req, res) => {
            const userId = req.params.id;
            this.dbManager.deleteUser(userId, (err) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                } else {
                    res.sendStatus(204);
                }
            });
        });

        this.app.get('/affiliations', async (req, res) => {
            const affiliations = await this.fetchAffiliationData();
            res.render('affiliations', { affiliations, user: req.session.user });
        });

        this.app.get('/rids', this.checkAuth, async (req, res) => {
            const rids = await this.fetchRIDData();
            res.render('rids', { rids, user: req.session.user });
        });

        this.app.get('/tgids', this.checkAuth, async (req, res) => {
            const tgids = await this.fetchTGData();
            res.render('tgids', { tgids, user: req.session.user });
        });

        this.app.get('/rid/query', this.checkAuth, RidHanlder.query.bind(this));
        this.app.put('/rid/add', this.checkAuth, RidHanlder.add.bind(this));
        this.app.put('/rid/delete', this.checkAuth, RidHanlder.delete.bind(this));
        this.app.get('/rid/commit', this.checkAuth, RidHanlder.commit.bind(this));

        this.app.get('/tg/query', this.checkAuth, TgidHandler.query.bind(this));
        this.app.put('/tg/add', this.checkAuth, TgidHandler.add.bind(this));
        this.app.put('/tg/delete', this.checkAuth, TgidHandler.delete.bind(this));
        this.app.get('/tg/commit', this.checkAuth, TgidHandler.commit.bind(this));
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
        const allData = {sites: [], affiliations: []};

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

    checkAuth(req, res, next) {
        if (req.session && req.session.user) {
            next();
        } else {
            res.redirect('/login');
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