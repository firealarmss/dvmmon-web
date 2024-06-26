document.addEventListener('DOMContentLoaded', () => {
    const peerCountElement = document.getElementById('peer-count');
    const searchInput = document.getElementById('peerIdSearch');
    const tableBody = document.getElementById('peer-list');
    const sortingMethodSelect = document.getElementById('sortingMethod');
    const sortButton = document.getElementById('sortButton');
    const togglePaused = document.getElementById('togglePaused');

    const netConnectionStatus = Object.freeze({
        0: "Waiting Connection",
        1: "Waiting Login",
        2: "Waiting Auth",
        3: "Waiting Config",
        4: "Running",
        5: "RPTL Received",
        6: "Challenge Sent",
        7: "MST Running",
        0x7FFFFFF: "NET_STAT_INVALID"
    });

    const socket = io();

    let paused = false;

    socket.on('update', (data) => {
        if (getPaused()) return;

        const updatedPeers = data.peers;
        console.log('Peer list update received:', updatedPeers);
        if (!Array.isArray(updatedPeers)) return;

        updateTableWithPeers(updatedPeers);

        peerCountElement.innerText = updatedPeers.length;
        sortTable(sortingMethodSelect.value);
    });

    function updateTableWithPeers(peers) {
        tableBody.innerHTML = '';
        peers.forEach(peer => {
            const newRow = createRowForPeer(peer);
            tableBody.appendChild(newRow);
        });
    }

    searchInput.addEventListener('input', () => {
        const searchValue = searchInput.value.toLowerCase();
        const tableRows = document.querySelectorAll('tbody tr');

        tableRows.forEach(row => {
            const peerIdCell = row.querySelector('td:nth-child(3)');
            const peerId = peerIdCell.textContent.toLowerCase();
            row.style.display = peerId.includes(searchValue) ? '' : 'none';
        });
    });

    sortButton.addEventListener('click', () => {
        sortTable(sortingMethodSelect.value);
    });

    togglePaused.addEventListener('click', () => {
        setPaused();
        togglePaused.innerText = getPaused() ? 'Resume Updates' : 'Pause Updates';
    });

    function createRowForPeer(peer) {
        const trClass = peer.connectionState && peer.connectionState.toString() !== '4' ? 'table-warning' : '';
        const connected = peer.connected ? 'Yes' : 'No';
        const peerId = peer.peerId || 'N/A';
        const identity = peer.config && peer.config.identity ? peer.config.identity : 'N/A';
        const address = peer.address || 'N/A';
        const connectionState = netConnectionStatus[peer.connectionState] || peer.connectionState || 'N/A';
        const rxFrequency = peer.config && peer.config.rxFrequency ? peer.config.rxFrequency : 'N/A';
        const txFrequency = peer.config && peer.config.txFrequency ? peer.config.txFrequency : 'N/A';
        const software = peer.config && peer.config.software ? peer.config.software : 'N/A';

        const row = document.createElement('tr');
        row.className = trClass;
        row.innerHTML = `
                <td>${connected}</td>
                <td>${connectionState}</td>
                <td>${peerId}</td>
                <td>${identity}</td>
                <td>${address}</td>
                <td>${rxFrequency}</td>
                <td>${txFrequency}</td>
                <td>${software}</td>
            `;
        return row;
    }

    function sortTable(sortMethod) {
        const tableRows = document.querySelectorAll('tbody tr');

        const rowsArray = Array.from(tableRows);

        rowsArray.sort((rowA, rowB) => {
            const idA = parseInt(rowA.querySelector('td:nth-child(3)').textContent, 10);
            const idB = parseInt(rowB.querySelector('td:nth-child(3)').textContent, 10);

            const connStateA = rowA.cells[1].textContent;
            const connStateB = rowB.cells[1].textContent;

            const softwareA = rowA.cells[7].textContent.trim().toLowerCase();
            const softwareB = rowB.cells[7].textContent.trim().toLowerCase();

            switch (sortMethod) {
                case 'asc':
                    return idA - idB;
                case 'desc':
                    return idB - idA;
                case 'connState':
                    return connStateA.localeCompare(connStateB);
                case 'software':
                    return softwareA.localeCompare(softwareB);
            }
        });

        rowsArray.forEach(row => tableBody.appendChild(row));
    }

    function setPaused() {
        paused = !paused;
    }

    function getPaused() {
        return paused;
    }

    sortTable('asc');
});