const RESTClient = require("./RESTClient");

class TgidHandler {

    static async query(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/tg/query', {});
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching TG data' });
        }
    }

    static async add(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('PUT', '/tg/add', req.body);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error adding TG' });
        }
    }

    static async delete(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('PUT', '/tg/delete', req.body);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error deleting TG' });
        }
    }

    static async commit(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/tg/commit', {});
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error committing TG changes' });
        }
    }
}

module.exports = TgidHandler;