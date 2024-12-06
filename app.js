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
const baileys = require('@whiskeysockets/baileys');

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
         'negocios',
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
   '💼 *NEGOCIOS*',
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
   .addAction(async (ctx, { flowDynamic, state }) => {
      const { contacto, colaborador } = await state.getMyState();
      const params = {
         phone: contacto,
         opc: 'ABRIR',
      };

      try {
         // Llamado a la API
         const response = await axios.post(
            'https://www.itdepsis.com.ar/7d156b/pm/getiavia.htm',
            null,
            { params }
         );
         const validado = response.data[0].msgdat;
         await state.update({ validado });
         console.log(validado, 'desde state');

         if (validado === 'true') {
            return await flowDynamic([
               colaborador,
               '👋 Bienvenido 📝 planilla abierta',
            ]);
         } else {
            return await flowDynamic(
               '🚫 No dispone de permisos para continuar.'
            );
         }
      } catch (error) {
         console.error('Error al llamar a la API:', error.message);
      }
   });

//FLOW TRAMO (SOLICITA LOCALIDAD DESDE HASTA, EN FORMATO LOCALIDAD-PROVINCIA)
const flowTramo = addKeyword(['tramo', 'TRAMO']).addAnswer(
   'Por favor, ingresa el tramo del viaje en el siguiente formato: Ej: Rafaela, Santa Fe a Córdoba, Córdoba',
   { capture: true },
   async (ctx, { flowDynamic, state }) => {
      const { validado } = await state.getMyState();

      if (validado === 'true') {
         const tramo = ctx.body;
         await state.update({ tramo });
         console.log('Tramo ingresado:', tramo);
         return await flowDynamic('Muchas gracias, que tengas un buen viaje.');
      } else {
         return await flowDynamic('🚫 No dispone de permisos para continuar.');
      }
   }
);

//FLOW NOMBRE SECCION (SOLICITA FOTO DE COMPROBANTE)
// const flowNombreSeccion = addKeyword([
//    'PEAJES',
//    'TAXI',
//    'ALOJAMIENTO',
//    'REFRIGERIO',
//    'COMBUSTIBLE',
//    'TRASLADO',
//    'TELEFONO',
//    'PAPELERIA',
//    'REMIS',
//    'COCHERA',
//    'NEGOCIOS',
// ])
//    .addAction(async (ctx, { state }) => {
//       const seccionNueva = ctx.body;
//       // Obtiene las secciones existentes del estado o inicializa un array vacío
//       const seccionesGuardadas = (await state.get('secciones')) || [];
//       // Verifica si la sección ya está guardada
//       if (!seccionesGuardadas.includes(seccionNueva)) {
//          seccionesGuardadas.push(seccionNueva);
//          await state.update({ secciones: seccionesGuardadas });
//       }
//       console.log('Secciones guardadas:', seccionesGuardadas);
//    })
//    .addAnswer(
//       'Por favor, carga el comprobante para continuar.',
//       { capture: true },
//       async (ctx, { flowDynamic, state }) => {
//          const stateData = await state.getMyState();
//          const user = stateData.colaborador;

//          function getLastSection(stateData) {
//             const secciones = stateData.secciones;
//             if (Array.isArray(secciones) && secciones.length > 0) {
//                return secciones[secciones.length - 1];
//             }
//             return null;
//          }
//          console.log('-->', ctx);
//          const file = ctx.message.documentMessage;
//          const from = ctx.from;
//          const lastSection = getLastSection(stateData);

//          if (!file) {
//             return await flowDynamic(
//                'No se ha recibido un archivo. Por favor, intenta nuevamente.'
//             );
//          }

//          try {
//             const fileUrl = file.url;
//             const extension = file.fileName?.split('.').pop();
//             const fileName = `${from}-${user}-${lastSection}-${matrandom(
//                1,
//                1000
//             )}.${extension}`;

//             const filePath = path.join(__dirname, 'comprobantes', fileName);

//             // descarga con axios -->
//             const response = await axios.get(fileUrl, {
//                responseType: 'arraybuffer',
//             });

//             fs.writeFileSync(filePath, response.data);
//             console.log('Archivo guardado en:', filePath);
//             return await flowDynamic('Tu archivo se ha guardado correctamente');
//          } catch (error) {
//             console.error('Error al guardar el archivo:', error);
//             return await flowDynamic(
//                'Hubo un problema al guardar el archivo. Intenta nuevamente.'
//             );
//          }
//       }
//    );

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
   'NEGOCIOS',
])
   .addAction(async (ctx, { state }) => {
      const seccionNueva = ctx.body;
      const seccionesGuardadas = (await state.get('secciones')) || [];
      if (!seccionesGuardadas.includes(seccionNueva)) {
         seccionesGuardadas.push(seccionNueva);
         await state.update({ secciones: seccionesGuardadas });
      }
      console.log('Secciones guardadas:', seccionesGuardadas);

      const nomSecc = seccionNueva;
      await state.update({ nomSecc });
   })
   .addAnswer(
      'Por favor, carga el comprobante desde tu galería, adjúntalo como documento o toma una foto para continuar.',
      { capture: true },
      async (ctx, { flowDynamic, provider, state }) => {
         const { contacto, nomSecc } = await state.getMyState();
         console.log(contacto);
         try {
            const imageMessage = ctx.message?.imageMessage;
            const documentMessage = ctx.message?.documentMessage;

            if (!imageMessage && !documentMessage) {
               console.log('No se detectó un archivo en el mensaje');
               return await flowDynamic(
                  'No se detectó un archivo válido en el mensaje. Por favor, intenta nuevamente adjuntando una imagen o documento.'
               );
            }

            console.log('MediaMessage:', imageMessage || documentMessage);

            // Descargar el archivo usando el mensaje adecuado
            const buffer = await baileys.downloadMediaMessage(
               ctx, // Pasar el mensaje completo
               'buffer', // Descargar como buffer
               {
                  logger: provider.logger,
                  reuploadRequest: provider.updateMediaMessage,
               } // Opciones adicionales
            );

            // Validar que el archivo no esté vacío
            if (!buffer || buffer.length === 0) {
               throw new Error('El archivo descargado está vacío.');
            }

            // Obtener la extensión y nombre del archivo
            const mimetype = imageMessage
               ? imageMessage.mimetype
               : documentMessage.mimetype;
            const extension = mimetype.split('/')[1]; // Obtener la extensión
            const fileName = `secc_${nomSecc}_${contacto}_${Date.now()}.${extension}`;
            const filePath = path.join(__dirname, 'comprobantes', fileName);
            fs.writeFileSync(filePath, buffer);

            console.log('Archivo guardado en:', filePath);
            return await flowDynamic(
               'Tu archivo se ha guardado correctamente.'
            );
         } catch (error) {
            console.error('Error al procesar el archivo:', error.message);
            return await flowDynamic(
               'Hubo un problema al procesar el archivo. Por favor, intenta nuevamente.'
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
const flowCerrar = addKeyword(['cerrar', 'CERRAR'])
   .addAnswer('¿Cierro la planilla de viáticos? Confirmame con un sí o no', {
      capture: true,
   })
   .addAction(async (ctx, { flowDynamic, state }) => {
      if (ctx.body.trim().toLowerCase() === 'si') {
         const userState = await state.getMyState();

         let stateResponseMessage = 'Resumen de tu planilla:\n\n';
         for (const [key, value] of Object.entries(userState)) {
            if (key !== 'validado' && key !== 'nomSecc') {
               const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
               stateResponseMessage += `*${formattedKey}:* ${value}\n`;
            }
         }

         // Envía el resumen al usuario
         await flowDynamic(stateResponseMessage);

         const params = {
            phone: userState.contacto,
            data: JSON.stringify(userState),
            opc: 'CERRAR',
         };

         try {
            const response = await axios.post(
               'https://www.itdepsis.com.ar/7d156b/pm/getiavia.htm',
               null,
               { params }
            );

            console.log(response.data, 'data');

            if (response.status === 200) {
               console.log('Respuesta exitosa:', response.data);

               // Limpiar el estado después de una respuesta exitosa
               await state.clear(ctx.from);
               console.log('Estado limpiado correctamente.');
               return await flowDynamic('Planilla cerrada correctamente.');
            } else {
               console.log('Error en la respuesta:', response.status);
            }
         } catch (error) {
            console.error('Error al llamar a la API:', error.message);
         }
      } else {
         console.log('Ok, puedes cerrarlo más tarde.');
         return await flowDynamic('Ok, puedes cerrarlo más tarde.');
      }
   });

//FLOW PLANTILLA
const flowPlanilla = addKeyword(['planilla', 'PLANILLA'])
   .addAnswer('Aquí tienes la información de la planilla de viáticos:')

   .addAction(async (ctx, { flowDynamic, state }) => {
      const contacto = ctx.from;
      const opc = ctx.body.toUpperCase();

      const userState = await state.getMyState();

      if (!userState || Object.keys(userState).length === 0) {
         // Si no hay datos en userState
         await flowDynamic('Planilla cerrada, no tienes datos para ver.');
      } else {
         // Si hay datos, construye el mensaje
         let stateResponseMessage = 'Planilla resumen:\n\n';
         for (const [key, value] of Object.entries(userState)) {
            // Omitir las claves 'validado' y 'nomSecc'
            if (key !== 'validado' && key !== 'nomSecc') {
               // Convertir la primera letra de la clave en mayúscula
               const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
               stateResponseMessage += `*${formattedKey}:* ${value}\n`;
            }
         }

         // Envía el resumen al usuario
         await flowDynamic(stateResponseMessage);

         try {
            const params = {
               phone: contacto,
               opc,
            };

            const response = await axios.post(
               'https://www.itdepsis.com.ar/7d156b/pm/getiavia.htm',
               null,
               { params }
            );

            console.log('Datos recibidos:', response.data);

            // Formatear los datos en un mensaje para el usuario
            if (response.data.length > 0) {
               let responseMessage = 'Resumen comprobantes cargados:\n\n';

               response.data.forEach((item, index) => {
                  responseMessage += `*Comprobante ${index + 1}*\n`;
                  responseMessage += `${item.o_nom.replace(/['"]+/g, '')}\n`;
                  responseMessage += `${item.o_cui.replace(/['"]+/g, '')}\n`;
                  responseMessage += `${item.o_tot.replace(/['"]+/g, '')}\n`;
                  responseMessage += '\n';
               });

               await flowDynamic(responseMessage);
            } else {
               await flowDynamic(
                  'No se encontraron registros en la planilla de viáticos.'
               );
            }
         } catch (error) {
            console.error(
               'Error al obtener los datos de la planilla:',
               error.message
            );
            await flowDynamic(
               'Hubo un problema al obtener los datos de tu planilla. Por favor, intenta nuevamente más tarde.'
            );
         }
      }
   });

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
