
const fecha = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
}).format(new Date());
console.log('Fecha Bogota:', fecha);
console.log('Fecha UTC:', new Date().toISOString());
