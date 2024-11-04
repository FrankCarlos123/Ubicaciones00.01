let folders = {};
let currentFolder = null;
let rotationInterval = null;
let scanner = null;
let scannerMode = 'add'; // 'add' o 'createFolder'

// Inicializar la aplicación
window.onload = function() {
    loadData();
    renderFolders();
};

// Gestión de datos
function loadData() {
    const savedData = localStorage.getItem('folders');
    if (savedData) {
        folders = JSON.parse(savedData);
    }
}

function saveData() {
    localStorage.setItem('folders', JSON.stringify(folders));
}

// Renderizado de carpetas
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
            e.stopPropagation();
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

function openFolder(folderId) {
    currentFolder = folderId;
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('folderView').classList.remove('hidden');
    document.getElementById('viewTitle').textContent = 'Ventana dentro de carpeta';
    startRotation();
}

// Rotación de datos
function startRotation() {
    stopRotation();
    
    const folder = folders[currentFolder];
    let currentIndex = -1;
    const qrDisplay = document.getElementById('qrDisplay');
    
    function showNext() {
        if (!folder.items.length) {
            qrDisplay.innerHTML = '';
            new QRCode(qrDisplay, {
                text: currentFolder,
                width: 256,
                height: 256
            });
            const label = document.createElement('div');
            label.className = 'qr-label';
            label.textContent = currentFolder;
            qrDisplay.appendChild(label);
            return;
        }
        
        currentIndex = (currentIndex + 1) % (folder.items.length * 2);
        qrDisplay.innerHTML = '';
        
        if (currentIndex % 2 === 0) {
            new QRCode(qrDisplay, {
                text: currentFolder,
                width: 256,
                height: 256
            });
            const label = document.createElement('div');
            label.className = 'qr-label';
            label.textContent = currentFolder;
            qrDisplay.appendChild(label);
        } else {
            const itemIndex = Math.floor(currentIndex / 2);
            new QRCode(qrDisplay, {
                text: folder.items[itemIndex],
                width: 256,
                height: 256
            });
            const label = document.createElement('div');
            label.className = 'qr-label';
            label.textContent = folder.items[itemIndex];
            qrDisplay.appendChild(label);
        }
    }
    
    showNext();
    rotationInterval = setInterval(showNext, 3000);
}

// Scanner
function showAddFolderDialog() {
    scannerMode = 'createFolder';
    startScanner();
}

function startScanner() {
    document.getElementById('scannerView').classList.remove('hidden');
    
    if (scanner) {
        stopScanner(); // Asegurarse de que cualquier instancia previa esté cerrada
    }
    
    scanner = new Html5QrcodeScanner("reader", {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    });
    
    scanner.render(handleScanSuccess, handleScanError);
}

function handleScanSuccess(decodedText) {
    if (scannerMode === 'createFolder') {
        if (folders[decodedText]) {
            alert('Esta carpeta ya existe');
        } else {
            folders[decodedText] = {
                items: []
            };
            saveData();
            renderFolders();
        }
    } else {
        if (!folders[currentFolder].items.includes(decodedText)) {
            folders[currentFolder].items.push(decodedText);
            saveData();
            stopRotation();
            startRotation();
        }
    }
    stopScanner();
}

function handleScanError(error) {
    // Solo manejar errores críticos, ignorar errores de escaneo normal
    if (error?.name === 'NotAllowedError') {
        alert('No se pudo acceder a la cámara. Por favor, permite el acceso.');
        stopScanner();
    }
}

function stopScanner() {
    if (scanner) {
        scanner.clear().catch(error => {
            console.error('Error al detener el scanner:', error);
        }).finally(() => {
            scanner = null;
            document.getElementById('scannerView').classList.add('hidden');
            scannerMode = 'add';
        });
    } else {
        document.getElementById('scannerView').classList.add('hidden');
        scannerMode = 'add';
    }
}

function stopRotation() {
    if (rotationInterval) {
        clearInterval(rotationInterval);
        rotationInterval = null;
    }
}

function backToMain() {
    currentFolder = null;
    stopRotation();
    document.getElementById('folderView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
    document.getElementById('viewTitle').textContent = 'Ventana Principal';
}

// Event Listeners
window.addEventListener('beforeunload', () => {
    stopRotation();
    stopScanner();
});
