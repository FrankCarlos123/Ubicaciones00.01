document.addEventListener('DOMContentLoaded', function() {
    const cameraBtn = document.querySelector('.camera-btn');
    const clearBtn = document.querySelector('.clear-btn');
    cameraBtn.onclick = startCamera;
    clearBtn.onclick = clearAll;
});

let stream = null;

async function startCamera() {
    try {
        let camera = document.getElementById('camera');
        const capturedImage = document.getElementById('captured-image');
        capturedImage.style.display = 'none';
        camera.style.display = 'block';

        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: { exact: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        camera.srcObject = stream;

        const cameraBtn = document.querySelector('.camera-btn');
        cameraBtn.textContent = 'Capturar';
        cameraBtn.onclick = captureImage;

    } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        alert('Error al acceder a la cámara. Por favor intenta de nuevo.');
    }
}

async function captureImage() {
    const camera = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const capturedImage = document.getElementById('captured-image');

    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(camera, 0, 0);

    capturedImage.src = canvas.toDataURL('image/jpeg', 1.0);
    capturedImage.style.display = 'block';
    capturedImage.classList.add('visible');
    camera.style.display = 'none';

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    const cameraBtn = document.querySelector('.camera-btn');
    cameraBtn.textContent = 'Escanear';
    cameraBtn.onclick = startCamera;

    processImage(canvas);
}

async function processImage(canvas) {
    try {
        showLoading(true);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        const formData = new FormData();
        formData.append('image', blob);
        
        console.log("Subiendo imagen...");
        const uploadResponse = await fetch('https://api.imgbb.com/1/upload?key=52caeb3987a1d3e1407627928b18c14e', {
            method: 'POST',
            body: formData
        });
        
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
            throw new Error('Error al subir la imagen');
        }

        const imageUrl = uploadResult.data.url;
        console.log("Imagen subida:", imageUrl);
        console.log("Enviando a Gemini...");

        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyCa362tZsWj38073XyGaMTmKC0YKc-W0I8`;
        
        const prompt = {
            "contents": [{
                "parts": [{
                    "text": `Analiza esta imagen de un horario laboral y calcula:

                    1. Horas diurnas (8:00 AM a 10:00 PM)
                    2. Horas nocturnas (10:00 PM a 8:00 AM)
                    3. Horas trabajadas en domingos
                    4. Horas trabajadas en festivos 
                    
                    Festivos en Barcelona 2024:
                    - 1 y 6 de enero
                    - 29 de marzo y 1 de abril
                    - 1 de mayo
                    - 24 de junio
                    - 15 de agosto
                    - 11 y 24 de septiembre
                    - 12 de octubre
                    - 1 de noviembre
                    - 6, 25 y 26 de diciembre

                    Devuelve SOLO un JSON con este formato:
                    {
                        "diurnal": 0.0,
                        "night": 0.0,
                        "sunday": 0.0,
                        "holiday": 0.0
                    }

                    La imagen está en: ${imageUrl}
                    
                    Solo necesito el JSON, sin explicaciones adicionales.`
                }]
            }]
        };

        const geminiResponse = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(prompt)
        });

        const geminiResult = await geminiResponse.json();
        console.log("Respuesta de Gemini:", geminiResult);
        
        if (geminiResult.candidates && geminiResult.candidates[0]) {
            const hoursData = JSON.parse(geminiResult.candidates[0].content.parts[0].text);
            console.log("Horas calculadas:", hoursData);
            
            updateHoursDisplay({
                diurnal: hoursData.diurnal,
                night: hoursData.night,
                sunday: hoursData.sunday,
                holiday: hoursData.holiday,
                total: hoursData.diurnal + hoursData.night + hoursData.sunday + hoursData.holiday
            });
        } else {
            throw new Error('No se pudieron calcular las horas');
        }

    } catch (error) {
        console.error('Error al procesar la imagen:', error);
        alert('Error al procesar la imagen. Por favor, intenta de nuevo.');
    } finally {
        showLoading(false);
    }
}

function updateHoursDisplay(hours) {
    document.getElementById('diurnal-hours').textContent = hours.diurnal.toFixed(2);
    document.getElementById('night-hours').textContent = hours.night.toFixed(2);
    document.getElementById('sunday-hours').textContent = hours.sunday.toFixed(2);
    document.getElementById('holiday-hours').textContent = hours.holiday.toFixed(2);
    document.getElementById('total-hours').textContent = hours.total.toFixed(2);
}

function showLoading(show) {
    Array.from(document.getElementsByClassName('hours-value')).forEach(el => {
        el.textContent = show ? 'Calculando...' : '0.00';
    });
}

function clearAll() {
    const capturedImage = document.getElementById('captured-image');
    capturedImage.style.display = 'none';
    capturedImage.src = '';
    capturedImage.classList.remove('visible');
    
    const camera = document.getElementById('camera');
    camera.style.display = 'none';
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    updateHoursDisplay({
        diurnal: 0,
        night: 0,
        sunday: 0,
        holiday: 0,
        total: 0
    });
    
    const cameraBtn = document.querySelector('.camera-btn');
    cameraBtn.textContent = 'Escanear';
    cameraBtn.onclick = startCamera;
}

// Manejador de errores global
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Error global:', message, error);
    alert('Ocurrió un error. Por favor, intenta de nuevo.');
    clearAll();
    return true;
};
