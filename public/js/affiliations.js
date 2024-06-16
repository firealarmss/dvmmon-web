document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    socket.on('update', (data) => {
        console.log('Received update from server:', data);
        const affiliationsDiv = document.getElementById('affiliations');
        affiliationsDiv.innerHTML = '';

        data.affiliations.forEach(affiliation => {
            if (affiliation.affiliations.length === 0) {
                return;
            }

            const card = document.createElement('div');
            card.className = 'card mb-3';
            card.innerHTML = `
                <div class="card-header">
                    Peer ID: ${affiliation.peerId}
                </div>
                <div class="card-body">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Destination ID</th>
                                <th>Source ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${affiliation.affiliations.map(a => `
                                <tr>
                                    <td>${a.dstId}</td>
                                    <td>${a.srcId}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            affiliationsDiv.appendChild(card);
        });

        if (document.body.classList.contains('dark-mode')) {
            document.querySelectorAll('.table').forEach(table => {
                table.classList.add('dark-mode');
            });
        } else {
            document.querySelectorAll('.table').forEach(table => {
                table.classList.remove('dark-mode');
            });
        }
    });
});