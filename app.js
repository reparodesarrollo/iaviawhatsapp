const {
   createBot,
   createProvider,
   createFlow,
   addKeyword,
   EVENTS,
   addAction,
} = require('@bot-whatsapp/bot');

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/json');

//importaciones necesarias
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { handlerAI } = require('./whisper');
require('dotenv').config();
const { daynow } = require('./helpers/helper.js');
const { matrandom } = require('./helpers/helper.js');

// Inicio de flows:

// FLOW VOICE
const flowVoice = addKeyword(EVENTS.VOICE_NOTE).addAnswer(
   'Aguarde por favor...',
   null,
   async (ctx, { flowDynamic, gotoFlow, state }) => {
      // Procesa la nota de voz
      const voiceToText = await handlerAI(ctx); // Procesa la voz a texto
      console.log('Texto transcrito de la voz:', voiceToText);

      // Convertimos todo a minúsculas para comparación
      const message = voiceToText.toLowerCase();

      // Lista de secciones reconocidas
      const secciones = [
         'peajes',
         'taxi',
         'alojamiento',
         'refrigerio',
         'combustible',
         'traslado',
         'teléfono',
         'papelería',
         'remis',
         'cochera',
         'comidas de equipos',
         'comidas de negocios',
         'móvil y viáticos',
         'mantenimiento',
         'aranceles',
         'computación',
         'capacitación',
         'avión combustible',
         'reparaciones avión',
      ];

      // Verifica si el mensaje contiene alguna de las secciones
      const seccionEncontrada = secciones.find((seccion) =>
         message.includes(seccion)
      );

      if (seccionEncontrada) {
         // Obtiene las secciones almacenadas en el estado o inicializa un array vacío
         const seccionesGuardadas = (await state.get('secciones')) || [];

         // Añade la nueva sección si no está ya en el array
         if (!seccionesGuardadas.includes(seccionEncontrada)) {
            seccionesGuardadas.push(seccionEncontrada);
            await state.update({ secciones: seccionesGuardadas });
         }

         console.log('Secciones almacenadas:', seccionesGuardadas);
         return gotoFlow(flowNombreSeccion); // Redirige al flujo de nombre de sección
      }

      switch (true) {
         case message.includes('hola'):
            return gotoFlow(flowPrincipal); // Redirige al flujo principal

         case message.includes('ayuda'):
            return gotoFlow(flowAyuda); // Redirige al flujo de ayuda

         case message.includes('abrir'):
            return gotoFlow(flowAbrir); // Redirige al flujo de abrir

         case message.includes('tramo'):
            return gotoFlow(flowTramo); // Redirige al flujo de tramo

         case message.includes('observaciones'):
            return gotoFlow(flowObservaciones); // Redirige al flujo de observaciones

         case message.includes('cerrar'):
            return gotoFlow(flowCerrar); // Redirige al flujo de cerrar

         case message.includes('planilla'):
            return gotoFlow(flowPlanilla); // Redirige al flujo de planilla

         default:
            // Respuesta por defecto
            await flowDynamic(
               'No pude identificar tu solicitud, por favor intenta nuevamente.'
            );
            break;
      }
   }
);

//FLOW PRINCIPAL
const flowPrincipal = addKeyword(['hola', 'HOLA', 'IAVIA', 'iavia'])
   .addAnswer('🙌 Hola bienvenido *IAVIA*.')
   .addAnswer(
      ' Estoy aquí para ayudarte a gestionar tus viáticos de manera rápida y eficiente.'
   )
   .addAnswer([
      'Te comparto los siguientes comandos:',
      ' ',
      '🤝 *AYUDA.*',
      '🔓 *ABRIR.*',
      '🚗 *TRAMO.*',
      '🏷️ *NOMBRE SECCION.*',
      '✏️ *OBSERVACIONES.*',
      '🔒 *CERRAR.*',
      '📋 *PLANILLA*.',
      ' ',
      'Recuerda que puedes escribir o enviarme una nota de voz con el comando.',
   ]);

//FLOW AYUDA FLOW HELP
const flowAyuda = addKeyword(['AYUDA', 'ayuda']).addAnswer([
   'Te comparto los siguientes nombre de secciones:',
   ' ',
   '🚗 *PEAJES*',
   '🚖 *TAXI*',
   '🏨 *ALOJAMIENTO*',
   '🍹 *REFRIGERIO*',
   '⛽ *COMBUSTIBLE*',
   '🚚 *TRASLADO*',
   '📞 *TELEFONO*',
   '📚 *PAPELERIA*',
   '🚖 *REMIS*',
   '🚗 *COCHERA*',
   '🍴 *COMIDAS DE EQUIPOS*',
   '🍽️ *COMIDAS DE NEGOCIOS*',
   '📱 *MOVIL. Y VIAT.*',
   '🔧 *MANTENIMIENTO*',
   '💼 *ARANCELES*',
   '💻 *COMPUTACION*',
   '🎓 *CAPACITACION*',
   '✈️ *AVION COMBUSTIBLE*',
   '🛠️ *REPARACIONES AVION*',
   ' ',
]);

//FLOW ABRIR (SOLICITA FECHA)

const flowAbrir = addKeyword(['abrir', 'ABRIR'])
   .addAnswer(
      `¿Podrías compartirme la fecha con el siguiente formato: ${daynow()}?`,
      { capture: true },
      async (ctx, { flowDynamic, state }) => {
         const fecha = ctx.body;
         const contacto = ctx.from;
         const colaborador = ctx.pushName;
         await state.update({ fecha, contacto, colaborador });
         return await flowDynamic('Muchas gracias.');
      }
   )
   .addAction(async (ctx, { state }) => {
      const { fecha, contacto, colaborador } = await state.getMyState();
      console.log('Fecha almacenada:', fecha);
      console.log('Número de contacto:', contacto);
      console.log('Colaborador:', colaborador);
   });

//FLOW TRAMO (SOLICITA LOCALIDAD DESDE HASTA, EN FORMATO LOCALIDAD-PROVINCIA)
const flowTramo = addKeyword(['tramo', 'TRAMO']).addAnswer(
   'Por favor, ingresa el tramo del viaje en el siguiente formato: Ej: Rafaela, Santa Fe a Córdoba, Córdoba',
   { capture: true },
   async (ctx, { flowDynamic, state }) => {
      const tramo = ctx.body;
      await state.update({ tramo });
      console.log('Tramo ingresado:', tramo);
      return await flowDynamic('Muchas gracias, que tengas un buen viaje.');
   }
);

//FLOW NOMBRE SECCION (SOLICITA FOTO DE COMPROBANTE)
const flowNombreSeccion = addKeyword([
   'PEAJES',
   'TAXI',
   'ALOJAMIENTO',
   'REFRIGERIO',
   'COMBUSTIBLE',
   'TRASLADO',
   'TELEFONO',
   'PAPELERIA',
   'REMIS',
   'COCHERA',
   'COMIDAS DE EQUIPOS',
   'COMIDAS DE NEGOCIOS',
   'MOVIL. Y VIAT.',
   'MANTENIMIENTO',
   'ARANCELES',
   'COMPUTACION',
   'CAPACITACION',
   'AVION COMBUSTIBLE',
   'REPARACIONES AVION',
])
   .addAction(async (ctx, { state }) => {
      const seccionNueva = ctx.body;
      // Obtiene las secciones existentes del estado o inicializa un array vacío
      const seccionesGuardadas = (await state.get('secciones')) || [];
      // Verifica si la sección ya está guardada
      if (!seccionesGuardadas.includes(seccionNueva)) {
         seccionesGuardadas.push(seccionNueva);
         await state.update({ secciones: seccionesGuardadas });
      }
      console.log('Secciones guardadas:', seccionesGuardadas);
   })
   .addAnswer(
      'Por favor, carga el comprobante para continuar.',
      { capture: true },
      async (ctx, { flowDynamic, state }) => {
         const stateData = await state.getMyState();
         const user = stateData.colaborador;

         function getLastSection(stateData) {
            const secciones = stateData.secciones;
            if (Array.isArray(secciones) && secciones.length > 0) {
               return secciones[secciones.length - 1];
            }
            return null;
         }

         const file = ctx.message.documentMessage;
         const from = ctx.from;
         const lastSection = getLastSection(stateData);

         if (!file) {
            return await flowDynamic(
               'No se ha recibido un archivo. Por favor, intenta nuevamente.'
            );
         }

         try {
            const fileUrl = file.url;
            const extension = file.fileName?.split('.').pop();
            const fileName = `${from}-${user}-${lastSection}-${matrandom(
               1,
               1000
            )}.${extension}`;

            const filePath = path.join(__dirname, 'comprobantes', fileName);

            // descarga con axios -->
            const response = await axios.get(fileUrl, {
               responseType: 'arraybuffer',
            });

            fs.writeFileSync(filePath, response.data);
            console.log('Archivo guardado en:', filePath);
            return await flowDynamic('Tu archivo se ha guardado correctamente');
         } catch (error) {
            console.error('Error al guardar el archivo:', error);
            return await flowDynamic(
               'Hubo un problema al guardar el archivo. Intenta nuevamente.'
            );
         }
      }
   );

//FLOW OBSERVACIONES
const flowObservaciones = addKeyword([
   'observaciones',
   'OBSERVACIONES',
]).addAnswer(
   '¿Tienes alguna observación o comentario?',
   { capture: true },
   async (ctx, { flowDynamic, state }) => {
      const observacion = ctx.body;
      await state.update({ observacion });
      console.log('Observación:', observacion);
      return await flowDynamic('Muchas gracias por el comentario.');
   }
);

//FLOW CERRAR
const flowCerrar = addKeyword(['cerrar', 'CERRAR']).addAnswer(
   'Cerrando planilla de viatios',
   { capture: true },
   async (ctx, { flowDynamic }) => {
      console.log('Cerrar:', ctx.body);
      return await flowDynamic('Muchas gracias.');
   }
);

//FLOW PLANTILLA
const flowPlanilla = addKeyword(['planilla', 'PLANILLA']).addAnswer(
   'Aquí tienes la información de la planilla de viáticos:',
   null,
   async (ctx, { flowDynamic, state }) => {
      // Obtiene todo el estado almacenado para el usuario actual
      const userState = await state.getMyState();

      // Formatea la información del estado para presentarla al usuario
      let responseMessage = 'Resumen de tus respuestas:\n\n';
      for (const [key, value] of Object.entries(userState)) {
         responseMessage += `*${key}:* ${value}\n`;
      }

      // Envía el resumen al usuario
      await flowDynamic(responseMessage);

      // Marca que la planilla ha sido solicitada
      await state.update({ planillaSolicitada: true });
      console.log('Planilla solicitada por:', ctx.from);
   }
);

// Configuraciones del bot

const main = async () => {
   const adapterDB = new MockAdapter();
   const adapterFlow = createFlow([
      flowPrincipal,
      flowAyuda,
      flowAbrir,
      flowTramo,
      flowNombreSeccion,
      flowObservaciones,
      flowCerrar,
      flowPlanilla,
      flowVoice,
   ]);
   const adapterProvider = createProvider(BaileysProvider);

   createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
   });

   QRPortalWeb();
};

main();
