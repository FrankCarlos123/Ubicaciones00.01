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
        
        // Convertir el canvas a base64
        const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
        
        console.log("Enviando imagen a Gemini Vision...");

        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=AIzaSyCa362tZsWj38073XyGaMTmKC0YKc-W0I8`;
        
        const prompt = {
            "contents": [{
                "parts": [
                    {"text": `En esta imagen de turnos laborales:

                    1. Identifica cada turno con su fecha y horario
                    2. Calcula las horas según:
                       - Diurnas (8:00 AM a 10:00 PM)
                       - Nocturnas (10:00 PM a 8:00 AM)
                       - Domingos (todo el día)
                       - Festivos (todo el día)
                    
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

                    Responde SOLO con un JSON así:
                    {
                        "diurnal": 0.0,
                        "night": 0.0,
                        "sunday": 0.0,
                        "holiday": 0.0
                    }
                    
                    Sin explicaciones adicionales, solo el JSON.`},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": base64Image
                        }
                    }
                ]
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
            try {
                const responseText = geminiResult.candidates[0].content.parts[0].text;
                // Buscar el JSON en la respuesta
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const hoursData = JSON.parse(jsonMatch[0]);
                    console.log("Horas calculadas:", hoursData);
                    
                    updateHoursDisplay({
                        diurnal: hoursData.diurnal,
                        night: hoursData.night,
                        sunday: hoursData.sunday,
                        holiday: hoursData.holiday,
                        total: hoursData.diurnal + hoursData.night + hoursData.sunday + hoursData.holiday
                    });
                } else {
                    throw new Error('No se encontró formato JSON válido en la respuesta');
                }
            } catch (parseError) {
                console.error('Error al parsear respuesta:', parseError);
                throw new Error('Error al procesar la respuesta de Gemini');
            }
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
