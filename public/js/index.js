document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    socket.on('update', (data) => {
        console.log('Received update from server:', data);
        const sitesDiv = document.getElementById('sites');
        sitesDiv.innerHTML = '';

        data.sites.forEach(site => {
            const siteDiv = document.createElement('div');
            siteDiv.className = 'col-md-4';
            siteDiv.innerHTML = `
                <div class="site-box mb-4" id="site-${site.identity}">
                    <h2>${site.identity}</h2>
                    <div class="control-channels-container"></div>
                    <div class="repeaters-container"></div>
                </div>
            `;
            sitesDiv.appendChild(siteDiv);

            const controlChannelsContainer = siteDiv.querySelector('.control-channels-container');
            const repeatersContainer = siteDiv.querySelector('.repeaters-container');

            if (site.type === 'controlChannel') {
                const controlChannel = site.status;
                const controlChannelDivId = `control-channel-${site.identity}-${controlChannel ? controlChannel.channelId : ''}`;
                let controlChannelDiv = document.getElementById(controlChannelDivId);

                if (!controlChannelDiv) {
                    controlChannelDiv = document.createElement('div');
                    controlChannelDiv.className = 'control-channel-box mb-4';
                    controlChannelDiv.id = controlChannelDivId;
                    controlChannelDiv.innerHTML = `
                        <h3>Control Channel ${controlChannel ? controlChannel.channelNo : 'N/A'}</h3>
                        <p>Tx Frequency: ${controlChannel && controlChannel.modem ? formatFrequency(controlChannel.modem.txFrequencyEffective) : 'N/A'}</p>
                        <p>Rx Frequency: ${controlChannel && controlChannel.modem ? formatFrequency(controlChannel.modem.rxFrequencyEffective) : 'N/A'}</p>
                        <div class="voice-channels-list"></div>
                    `;
                    controlChannelsContainer.appendChild(controlChannelDiv);
                }

                const voiceChannelsList = controlChannelDiv.querySelector('.voice-channels-list');
                site.voiceChannels.forEach(voiceChannel => {
                    const voiceChannelStatus = voiceChannel.status;
                    const existingVoiceChannelDiv = document.getElementById(`voice-channel-${voiceChannelStatus ? voiceChannelStatus.channelNo : ''}`);

                    if (voiceChannelStatus && voiceChannelStatus.tx && voiceChannelStatus.lastSrcId !== 0 && voiceChannelStatus.lastDstId !== 0) {
                        if (!existingVoiceChannelDiv) {
                            const voiceChannelDiv = document.createElement('div');
                            voiceChannelDiv.className = 'voice-channel card mb-2 keyed';
                            voiceChannelDiv.id = `voice-channel-${voiceChannelStatus.channelNo}`;
                            voiceChannelDiv.innerHTML = `
                                <div class="card-body">
                                    <h5 class="card-title">Voice Channel: ${voiceChannelStatus.channelNo}</h5>
                                    <p class="card-text">Tx Frequency: ${voiceChannelStatus.modem ? formatFrequency(voiceChannelStatus.modem.txFrequencyEffective) : 'N/A'}</p>
                                    <p class="card-text">Rx Frequency: ${voiceChannelStatus.modem ? formatFrequency(voiceChannelStatus.modem.rxFrequencyEffective) : 'N/A'}</p>
                                    <p class="card-text">Last Dst: ${voiceChannelStatus.lastDstId}</p>
                                    <p class="card-text">Last Src: ${voiceChannelStatus.lastSrcId}</p>
                                </div>
                            `;
                            voiceChannelsList.appendChild(voiceChannelDiv);
                        }
                    }
                });
            }

            if (site.type === 'conventional') {
                const repeater = site.status;
                const repeaterDiv = document.createElement('div');
                repeaterDiv.className = 'repeater-box mb-4';
                repeaterDiv.innerHTML = `
                    <h3>Repeater ${site.identity}</h3>
                    <p>Tx Frequency: ${repeater && repeater.modem ? formatFrequency(repeater.modem.txFrequencyEffective) : 'N/A'}</p>
                    <p>Rx Frequency: ${repeater && repeater.modem ? formatFrequency(repeater.modem.rxFrequencyEffective) : 'N/A'}</p>
                `;
                repeatersContainer.appendChild(repeaterDiv);
            }
        });
    });

    function formatFrequency(frequency) {
        if (!frequency) return 'N/A';
        const freqStr = frequency.toString().padStart(9, '0');
        return `${freqStr.slice(0, 3)}.${freqStr.slice(3, 6)}.${freqStr.slice(6, 9)}`;
    }
});