// helper.js

// Función para la fecha
function daynow() {
   const now = new Date();
   const day = String(now.getDate()).padStart(2, '0');
   const month = String(now.getMonth() + 1).padStart(2, '0');
   const year = now.getFullYear();
   return `${day}/${month}/${year}`;
}

// Set para generar números únicos
const generatedNumbers = new Set();

function matrandom(min, max) {
   if (generatedNumbers.size >= max - min + 1) {
      throw new Error('Todos los números en el rango ya han sido generados.');
   }

   let randomNum;
   do {
      randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
   } while (generatedNumbers.has(randomNum));

   generatedNumbers.add(randomNum);
   return randomNum;
}

// Exportar ambas funciones
module.exports = { daynow, matrandom };
