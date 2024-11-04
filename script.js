// Mantener el código existente y modificar/agregar las siguientes funciones

function renderFolders() {
    const grid = document.getElementById('qrGrid');
    grid.innerHTML = '';
    
    Object.keys(folders).forEach(folderId => {
        const div = document.createElement('div');
        div.className = 'qr-item';
        div.onclick = () => openFolder(folderId);
        
        // Agregar botón de eliminar
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Evitar que se abra la carpeta al eliminar
            if(confirm('¿Estás seguro de que deseas eliminar esta carpeta?')) {
                deleteFolder(folderId);
            }
        };
        
        const qrDiv = document.createElement('div');
        new QRCode(qrDiv, {
            text: folderId,
            width: 128,
            height: 128
        });
        
        const label = document.createElement('div');
        label.className = 'qr-label';
        label.textContent = folderId;
        
        div.appendChild(deleteBtn);
        div.appendChild(qrDiv);
        div.appendChild(label);
        grid.appendChild(div);
    });
}

function deleteFolder(folderId) {
    delete folders[folderId];
    saveData();
    renderFolders();
}

function backToMain() {
    currentFolder = null;
    stopRotation();
    document.getElementById('folderView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
    document.getElementById('viewTitle').textContent = 'Ventana Principal';
}

// Modificar la función showAddFolderDialog para usar el scanner
function showAddFolderDialog() {
    document.getElementById('scannerView').classList.remove('hidden');
    scanner = new Html5QrcodeScanner("reader", { 
        fps: 10,
        qrbox: {width: 250, height: 250}
    });
    
    scanner.render((decodedText) => {
        if(folders[decodedText]) {
            alert('Esta carpeta ya existe');
        } else {
            folders[decodedText] = {
                items: []
            };
            saveData();
            renderFolders();
        }
        stopScanner();
    });
}