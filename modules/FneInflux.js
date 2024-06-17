const { InfluxDB } = require('@influxdata/influxdb-client');

class FneInflux {
    constructor(config, debug = false) {
        this.influxDB = new InfluxDB({ url: config.url, token: config.token });
        this.queryApi = this.influxDB.getQueryApi(config.org);
        this.bucket = config.bucket;

        this.debug = debug;
    }

    async fetchAllChannelData() {
        const fluxQuery = `from(bucket: "${this.bucket}")
                           |> range(start: -1h)
                           |> filter(fn: (r) => r._measurement == "peer_status")
                           |> sort(columns: ["_time"], desc: true)
                           |> unique(column: "peerId")`;
        const allData = { sites: [] };

        try {
            const result = await this.queryApi.collectRows(fluxQuery);
            const siteMap = new Map();

            result.forEach(row => {
                const peerId = row.peerId;
                const field = row._field;
                const value = row._value;

                if (!siteMap.has(peerId)) {
                    siteMap.set(peerId, { peerId, data: {} });
                }

                const siteData = siteMap.get(peerId);

                if (field === 'identity') {
                    siteData.data.identity = value;
                } else if (field === 'status') {
                    try {
                        siteData.data.status = JSON.parse(value);
                    } catch (error) {
                        console.error('Error parsing status JSON:', error);
                    }
                }
            });

            siteMap.forEach((value, key) => {
                allData.sites.push(value.data);
            });

            return allData;
        } catch (error) {
            console.error('Error fetching data from InfluxDB');

            if (this.debug) {
                console.error(error);
            }

            return null;
        }
    }
}

module.exports = FneInflux;