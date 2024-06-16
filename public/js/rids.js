document.addEventListener('DOMContentLoaded', () => {
    fetch('/rid/query')
        .then(response => response.json())
        .then(data => {
            const ridsDiv = document.getElementById('rids');
            ridsDiv.innerHTML = '';

            data.rids.forEach(rid => {
                const card = document.createElement('div');
                card.className = 'card mb-3';
                card.innerHTML = `
                    <div class="card-header">
                        RID: ${rid.id}
                    </div>
                    <div class="card-body">
                        <p>Enabled: ${rid.enabled}</p>
                        <p>Alias: ${rid.alias}</p>
                        <button class="btn btn-danger" onclick="deleteRID(${rid.id})">Delete</button>
                    </div>
                `;
                ridsDiv.appendChild(card);
            });
        }).catch(error => {
            console.error('Error:', error);
        });

    document.getElementById('addRidForm').addEventListener('submit', function(event) {
        event.preventDefault();

        const rid = parseInt(document.getElementById('rid').value);
        const enabled = !!document.getElementById('enabled').value;
        const alias = document.getElementById('alias').value;

        fetch('/rid/add', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rid, enabled, alias }),
        }).then(response => response.json()).then(data => {
            console.log('Success:', data);
            $('#addRidModal').modal('hide');
            location.reload();
        }).catch(error => {
            console.error('Error:', error);
        });
    });
});

function deleteRID(rid) {
    rid = parseInt(rid);

    fetch('/rid/delete', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rid }),
    }).then(response => response.json()).then(data => {
        location.reload();
    }).catch(error => {
        console.error('Error:', error);
    });
}

function commitRID() {
    fetch('/rid/commit', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    }).then(response => response.json()).then(data => {
        console.log('Success:', data);
        alert('RID Commit Successful');
    }).catch(error => {
        console.error('Error:', error);
    });
}