const RESTClient = require("./RESTClient");

class RidHandler {
    static async query(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/rid/query', {});
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching RID data' });
        }
    }

    static async add(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('PUT', '/rid/add', req.body);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error adding RID' });
        }
    }

    static async delete(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('PUT', '/rid/delete', req.body);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error deleting RID' });
        }
    }

    static async commit(req, res) {
        const restClient = new RESTClient(this.config.fne.address, this.config.fne.port, this.config.fne.password, false);
        try {
            const response = await restClient.send('GET', '/rid/commit', {});
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: 'Error committing RID changes' });
        }
    }
}

module.exports = RidHandler;