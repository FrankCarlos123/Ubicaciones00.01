document.addEventListener('DOMContentLoaded', function() {
    const cameraBtn = document.querySelector('.camera-btn');
    const clearBtn = document.querySelector('.clear-btn');
    cameraBtn.onclick = startCamera;
    clearBtn.onclick = clearAll;
});

let stream = null;

// Días festivos en Barcelona 2024
const festivos2024 = [
    "2024-01-01", // Año Nuevo
    "2024-01-06", // Reyes
    "2024-03-29", // Viernes Santo
    "2024-04-01", // Lunes de Pascua
    "2024-05-01", // Día del Trabajo
    "2024-06-24", // San Juan
    "2024-08-15", // Asunción
    "2024-09-11", // Diada
    "2024-09-24", // La Mercè
    "2024-10-12", // Hispanidad
    "2024-11-01", // Todos los Santos
    "2024-12-06", // Constitución
    "2024-12-25", // Navidad
    "2024-12-26"  // San Esteban
];

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
        
        const uploadResponse = await fetch('https://api.imgbb.com/1/upload?key=52caeb3987a1d3e1407627928b18c14e', {
            method: 'POST',
            body: formData
        });
        
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
            throw new Error('Error al subir la imagen');
        }

        const imageUrl = uploadResult.data.url;
        const ocrUrl = `https://api.ocr.space/parse/imageurl?apikey=helloworld&url=${encodeURIComponent(imageUrl)}&OCREngine=2`;
        
        const ocrResponse = await fetch(ocrUrl);
        const ocrResult = await ocrResponse.json();
        
        if (!ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
            throw new Error('OCR no pudo extraer texto de la imagen');
        }

        const text = ocrResult.ParsedResults[0].ParsedText;

        // Prompt para Gemini
        const prompt = {
            "contents": [{
                "parts": [{
                    "text": `Analiza el siguiente horario y extrae las horas trabajadas. El formato es dd Mes HH:mm-HH:mm. Por favor, devuelve un JSON con el siguiente formato:
                    {
                        "shifts": [
                            {
                                "date": "2024-MM-DD",
                                "start": "HH:mm",
                                "end": "HH:mm"
                            }
                        ]
                    }
                    Solo incluye los turnos válidos. El texto es:\n\n${text}`
                }]
            }]
        };

        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyCa362tZsWj38073XyGaMTmKC0YKc-W0I8`;
        
        const geminiResponse = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(prompt)
        });

        const geminiResult = await geminiResponse.json();
        
        if (geminiResult.candidates && geminiResult.candidates[0]) {
            const shiftsData = JSON.parse(geminiResult.candidates[0].content.parts[0].text);
            calculateHours(shiftsData.shifts);
        } else {
            throw new Error('No se pudo procesar el horario');
        }

    } catch (error) {
        console.error('Error al procesar la imagen:', error);
        alert('Error al procesar la imagen. Por favor, intenta de nuevo.');
    } finally {
        showLoading(false);
    }
}
function calculateHours(shifts) {
    let diurnalHours = 0;
    let nightHours = 0;
    let sundayHours = 0;
    let holidayHours = 0;
    
    shifts.forEach(shift => {
        const date = new Date(shift.date);
        const [startHour, startMinute] = shift.start.split(':').map(Number);
        const [endHour, endMinute] = shift.end.split(':').map(Number);
        
        // Convertir a minutos para facilitar el cálculo
        let startTime = startHour * 60 + startMinute;
        let endTime = endHour * 60 + endMinute;
        
        // Si la hora final es menor que la inicial, significa que cruza la medianoche
        if (endTime < startTime) {
            endTime += 24 * 60; // Agregar 24 horas en minutos
        }
        
        // Calcular duración total del turno en minutos
        const totalMinutes = endTime - startTime;
        
        // Verificar si es domingo
        if (date.getDay() === 0) {
            sundayHours += totalMinutes / 60;
            return; // No contar las demás categorías si es domingo
        }
        
        // Verificar si es festivo
        const dateString = date.toISOString().split('T')[0];
        if (festivos2024.includes(dateString)) {
            holidayHours += totalMinutes / 60;
            return; // No contar las demás categorías si es festivo
        }
        
        // Dividir entre horas diurnas y nocturnas
        let currentTime = startTime;
        while (currentTime < endTime) {
            const hour = Math.floor((currentTime % (24 * 60)) / 60);
            
            // Contar minutos en el intervalo actual
            const minutesToAdd = Math.min(60 - (currentTime % 60), endTime - currentTime);
            
            if (hour >= 8 && hour < 22) {
                diurnalHours += minutesToAdd / 60;
            } else {
                nightHours += minutesToAdd / 60;
            }
            
            currentTime += minutesToAdd;
        }
    });
    
    // Actualizar la UI con los resultados
    updateHoursDisplay({
        diurnal: diurnalHours,
        night: nightHours,
        sunday: sundayHours,
        holiday: holidayHours,
        total: diurnalHours + nightHours + sundayHours + holidayHours
    });
}

function updateHoursDisplay(hours) {
    document.getElementById('diurnal-hours').textContent = hours.diurnal.toFixed(2);
    document.getElementById('night-hours').textContent = hours.night.toFixed(2);
    document.getElementById('sunday-hours').textContent = hours.sunday.toFixed(2);
    document.getElementById('holiday-hours').textContent = hours.holiday.toFixed(2);
    document.getElementById('total-hours').textContent = hours.total.toFixed(2);
}

function showLoading(show) {
    const loadingElement = document.querySelector('.loading');
    if (show) {
        loadingElement?.classList.add('visible');
    } else {
        loadingElement?.classList.remove('visible');
    }
}

function clearAll() {
    // Limpiar la imagen capturada
    const capturedImage = document.getElementById('captured-image');
    capturedImage.style.display = 'none';
    capturedImage.src = '';
    capturedImage.classList.remove('visible');
    
    // Limpiar la cámara
    const camera = document.getElementById('camera');
    camera.style.display = 'none';
    
    // Detener el stream si existe
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    // Resetear los contadores
    updateHoursDisplay({
        diurnal: 0,
        night: 0,
        sunday: 0,
        holiday: 0,
        total: 0
    });
    
    // Resetear el botón de la cámara
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
