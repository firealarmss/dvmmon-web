document.addEventListener('DOMContentLoaded', () => {
    fetch('/tg/query')
        .then(response => response.json())
        .then(data => {
            const tgidsDiv = document.getElementById('tgids');
            tgidsDiv.innerHTML = '';

            data.tgs.forEach(tg => {
                const card = document.createElement('div');
                card.className = 'card mb-3';
                card.innerHTML = `
                    <div class="card-header">
                        TGID: ${tg.source.tgid}
                    </div>
                    <div class="card-body">
                        <p>Name: ${tg.name}</p>
                        <p>Slot: ${tg.source.slot}</p>
                        <p>Active: ${tg.config.active}</p>
                        <button class="btn btn-warning" onclick="editTG(${tg.source.tgid}, '${tg.name}', ${tg.source.slot}, ${tg.config.active}, ${tg.config.parrot})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteTG(${tg.source.tgid}, ${tg.source.slot})">Delete</button>
                    </div>
                `;
                tgidsDiv.appendChild(card);
            });
        }).catch(error => {
        console.error('Error:', error);
    });

    document.getElementById('addTgForm').addEventListener('submit', function(event) {
        event.preventDefault();

        const tgName = document.getElementById('tgName').value;
        const tgSlot = parseInt(document.getElementById('tgSlot').value);
        const tgId = parseInt(document.getElementById('tgId').value);
        const tgActive = document.getElementById('tgActive').value === 'true';

        fetch('/tg/add', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: tgName,
                source: { tgid: tgId, slot: tgSlot },
                config: { active: tgActive }
            }),
        }).then(response => response.json()).then(data => {
            console.log('Success:', data);
            $('#addTgModal').modal('hide');
            location.reload();
        }).catch(error => {
            console.error('Error:', error);
        });
    });

    document.getElementById('editTgForm').addEventListener('submit', function(event) {
        event.preventDefault();

        const tgName = document.getElementById('editTgName').value;
        const tgSlot = parseInt(document.getElementById('editTgSlot').value);
        const tgId = parseInt(document.getElementById('editTgIdInput').value);
        const tgActive = document.getElementById('editTgActive').value === 'true';
        const tgParrot = document.getElementById('editTgParrot').value === 'true';
        const tgAffiliated = document.getElementById('editTgAffiliated').value === 'true';

        console.log(tgName, tgSlot, tgId, tgActive, tgParrot, tgAffiliated);

        fetch('/tg/add', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: tgName,
                source: { tgid: tgId, slot: tgSlot },
                config: { active: tgActive, parrot: tgParrot, affiliated: tgAffiliated, exclusion: [], inclusion: [], preferred: [], rewrite: [] }
            }),
        }).then(response => response.json()).then(data => {
            console.log('Success:', data);
            $('#editTgModal').modal('hide');
            location.reload();
        }).catch(error => {
            console.error('Error:', error);
        });
    });
});

function editTG(tgid, name, slot, active, parrot) {
    document.getElementById('editTgName').value = name;
    document.getElementById('editTgSlot').value = slot;
    document.getElementById('editTgIdInput').value = tgid;
    document.getElementById('editTgActive').value = active.toString();
    document.getElementById('editTgParrot').value = parrot.toString();
    $('#editTgModal').modal('show');
}

function deleteTG(tgid, slot) {
    fetch('/tg/delete', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tgid, slot }),
    }).then(response => response.json()).then(data => {
        location.reload();
    }).catch(error => {
        console.error('Error:', error);
    });
}

function commitTG() {
    fetch('/tg/commit', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    }).then(response => response.json()).then(data => {
        console.log('Success:', data);
        alert('TG Commit Successful');
    }).catch(error => {
        console.error('Error:', error);
    });
}