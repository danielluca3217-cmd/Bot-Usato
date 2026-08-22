// ============================================================
// BOT DISCORD - OUTLET USATO GARANTITO
// ============================================================

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// ============================================================
// 🔧 CONFIGURAZIONE
// ============================================================
const TOKEN = process.env.DISCORD_TOKEN || 'MTU0MDUxMjQwMDA2OTg5NDE1NQ.GdXw6q.tbB1ZhSkVG6UPfpXWuszLE3EFufMkxgcaVZvlc';
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '6a8836b0f5f4af5e2930f4bb';
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY || '$2a$10$wZYd3ki9TiZ/VDC337viNOiC1znyu5NWat6lENgmgdSaUfQ.2.jPO';
const CANALE_COMANDI = process.env.CANALE_COMANDI || 'ID_CANALE_DISCORD';

// ============================================================
// 📦 CLIENT DISCORD
// ============================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// ============================================================
// 📦 FUNZIONI DATABASE
// ============================================================
async function caricaDati() {
    try {
        const response = await axios.get(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_API_KEY }
        });
        return response.data.record || { auto: [], prenotazioni: [] };
    } catch (error) {
        console.error('❌ Errore caricamento:', error.message);
        return { auto: [], prenotazioni: [] };
    }
}

async function salvaDati(dati) {
    try {
        await axios.put(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, 
            dati,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY
                }
            }
        );
        return true;
    } catch (error) {
        console.error('❌ Errore salvataggio:', error.message);
        return false;
    }
}

function isAutoPrenotata(autoId, prenotazioni) {
    return prenotazioni.some(p => p.autoId === autoId && p.stato === 'confermata');
}

// ============================================================
// 🚗 COMANDO: AGGIUNGI AUTO
// ============================================================
async function aggiungiAuto(parts, username) {
    if (parts.length < 8) {
        return { success: false, messaggio: '❌ Formato: /aggiungi-auto marca modello anno prezzo km alimentazione cambio\nEsempio: /aggiungi-auto Audi A3 2020 22900 42000 Diesel Automatico' };
    }

    try {
        const data = await caricaDati();
        const auto = data.auto || [];
        
        const marca = parts[1];
        const modello = parts[2];
        const anno = parseInt(parts[3]);
        const prezzo = parseInt(parts[4]);
        const km = parseInt(parts[5]);
        const alimentazione = parts[6];
        const cambio = parts.slice(7).join(' ');

        if (isNaN(anno) || isNaN(prezzo) || isNaN(km)) {
            return { success: false, messaggio: '❌ Anno, prezzo e km devono essere numeri!' };
        }

        const newId = auto.length > 0 ? Math.max(...auto.map(a => a.id)) + 1 : 1;
        const nuovaAuto = { id: newId, marca, modello, anno, prezzo, km, alimentazione, cambio };
        auto.push(nuovaAuto);
        data.auto = auto;

        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Auto aggiunta con successo!')
                .setDescription(`🚗 **${marca} ${modello}**`)
                .addFields(
                    { name: '📅 Anno', value: String(anno), inline: true },
                    { name: '💰 Prezzo', value: `€ ${prezzo.toLocaleString()}`, inline: true },
                    { name: '📏 Km', value: `${km.toLocaleString()} km`, inline: true },
                    { name: '⛽ Alimentazione', value: alimentazione, inline: true },
                    { name: '⚙️ Cambio', value: cambio, inline: true },
                    { name: '🆔 ID', value: String(newId), inline: true }
                )
                .setFooter({ text: `Aggiunta da: ${username}` })
                .setTimestamp();
            return { success: true, embed: embed };
        }
        return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
    } catch (error) {
        return { success: false, messaggio: `❌ Errore: ${error.message}` };
    }
}

// ============================================================
// ✏️ COMANDO: MODIFICA AUTO
// ============================================================
async function modificaAuto(parts, username) {
    if (parts.length < 9) {
        return { success: false, messaggio: '❌ Formato: /modifica-auto id marca modello anno prezzo km alimentazione cambio\nEsempio: /modifica-auto 5 Audi A3 2021 23900 38000 Diesel Automatico' };
    }

    try {
        const data = await caricaDati();
        const auto = data.auto || [];
        
        const id = parseInt(parts[1]);
        const marca = parts[2];
        const modello = parts[3];
        const anno = parseInt(parts[4]);
        const prezzo = parseInt(parts[5]);
        const km = parseInt(parts[6]);
        const alimentazione = parts[7];
        const cambio = parts.slice(8).join(' ');

        if (isNaN(id) || isNaN(anno) || isNaN(prezzo) || isNaN(km)) {
            return { success: false, messaggio: '❌ ID, anno, prezzo e km devono essere numeri!' };
        }

        const index = auto.findIndex(a => a.id === id);
        if (index === -1) {
            return { success: false, messaggio: `❌ Auto con ID ${id} non trovata.` };
        }

        if (isAutoPrenotata(id, data.prenotazioni || [])) {
            return { success: false, messaggio: `❌ L'auto con ID ${id} è prenotata e non può essere modificata.` };
        }

        auto[index] = { ...auto[index], marca, modello, anno, prezzo, km, alimentazione, cambio };
        data.auto = auto;

        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0xff9900)
                .setTitle('✏️ Auto modificata con successo!')
                .setDescription(`🚗 **${marca} ${modello}**`)
                .addFields(
                    { name: '📅 Anno', value: String(anno), inline: true },
                    { name: '💰 Prezzo', value: `€ ${prezzo.toLocaleString()}`, inline: true },
                    { name: '📏 Km', value: `${km.toLocaleString()} km`, inline: true },
                    { name: '⛽ Alimentazione', value: alimentazione, inline: true },
                    { name: '⚙️ Cambio', value: cambio, inline: true },
                    { name: '🆔 ID', value: String(id), inline: true }
                )
                .setFooter({ text: `Modificata da: ${username}` })
                .setTimestamp();
            return { success: true, embed: embed };
        }
        return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
    } catch (error) {
        return { success: false, messaggio: `❌ Errore: ${error.message}` };
    }
}

// ============================================================
// 🗑️ COMANDO: ELIMINA AUTO
// ============================================================
async function eliminaAuto(parts, username) {
    if (parts.length < 2) {
        return { success: false, messaggio: '❌ Formato: /elimina-auto id\nEsempio: /elimina-auto 5' };
    }

    try {
        const data = await caricaDati();
        const auto = data.auto || [];
        const id = parseInt(parts[1]);

        if (isNaN(id)) {
            return { success: false, messaggio: '❌ ID deve essere un numero!' };
        }

        const index = auto.findIndex(a => a.id === id);
        if (index === -1) {
            return { success: false, messaggio: `❌ Auto con ID ${id} non trovata.` };
        }

        if (isAutoPrenotata(id, data.prenotazioni || [])) {
            return { success: false, messaggio: `❌ L'auto con ID ${id} è prenotata e non può essere eliminata.` };
        }

        const autoEliminata = auto[index];
        auto.splice(index, 1);
        data.auto = auto;

        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🗑️ Auto eliminata con successo!')
                .setDescription(`🚗 **${autoEliminata.marca} ${autoEliminata.modello}** (ID: ${id})`)
                .setFooter({ text: `Eliminata da: ${username}` })
                .setTimestamp();
            return { success: true, embed: embed };
        }
        return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
    } catch (error) {
        return { success: false, messaggio: `❌ Errore: ${error.message}` };
    }
}

// ============================================================
// 📋 COMANDO: LISTA AUTO
// ============================================================
async function listaAuto() {
    const data = await caricaDati();
    const auto = data.auto || [];
    const prenotazioni = data.prenotazioni || [];

    if (auto.length === 0) {
        return { success: false, messaggio: '📋 **Nessuna auto disponibile.**' };
    }

    let testo = '📋 **Lista auto disponibili:**\n\n';
    auto.slice(0, 15).forEach((a) => {
        const prenotata = isAutoPrenotata(a.id, prenotazioni) ? ' 🔒 PRENOTATA' : '';
        testo += `**${a.id}.** ${a.marca} ${a.modello} - € ${a.prezzo.toLocaleString()} - ${a.anno} - ${a.km}km${prenotata}\n`;
    });
    if (auto.length > 15) {
        testo += `\n... e altre ${auto.length - 15} auto`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📋 Lista auto')
        .setDescription(testo)
        .setFooter({ text: `Totale: ${auto.length} auto` })
        .setTimestamp();
    return { success: true, embed: embed };
}

// ============================================================
// 📅 COMANDO: PRENOTA AUTO
// ============================================================
async function prenotaAuto(parts, username) {
    if (parts.length < 8) {
        return { success: false, messaggio: '❌ Formato: /prenota-auto id nome cognome email telefono data\nEsempio: /prenota-auto 3 Marco Rossi marco@email.com 3331234567 22-08-2026' };
    }

    try {
        const data = await caricaDati();
        const auto = data.auto || [];
        const prenotazioni = data.prenotazioni || [];

        const id = parseInt(parts[1]);
        const nome = parts[2];
        const cognome = parts[3];
        const email = parts[4];
        const telefono = parts[5];
        const dataPrenotazione = parts[6];

        if (isNaN(id)) {
            return { success: false, messaggio: '❌ ID deve essere un numero!' };
        }

        const autoEsiste = auto.find(a => a.id === id);
        if (!autoEsiste) {
            return { success: false, messaggio: `❌ Auto con ID ${id} non trovata.` };
        }

        if (isAutoPrenotata(id, prenotazioni)) {
            return { success: false, messaggio: `❌ L'auto ${autoEsiste.marca} ${autoEsiste.modello} è già prenotata!` };
        }

        const nuovaPrenotazione = {
            id: Date.now(),
            autoId: id,
            nome,
            cognome,
            email,
            telefono,
            data: dataPrenotazione,
            stato: 'in-attesa',
            dataRichiesta: new Date().toLocaleDateString('it-IT')
        };

        prenotazioni.push(nuovaPrenotazione);
        data.prenotazioni = prenotazioni;

        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0x00ccff)
                .setTitle('📅 Prenotazione creata!')
                .setDescription(`🚗 **${autoEsiste.marca} ${autoEsiste.modello}** (ID: ${id})`)
                .addFields(
                    { name: '👤 Cliente', value: `${nome} ${cognome}`, inline: true },
                    { name: '📧 Email', value: email, inline: true },
                    { name: '📞 Telefono', value: telefono, inline: true },
                    { name: '📅 Data richiesta', value: dataPrenotazione, inline: true },
                    { name: '📌 Stato', value: '🟡 In attesa', inline: true }
                )
                .setFooter({ text: `Prenotata da: ${username}` })
                .setTimestamp();
            return { success: true, embed: embed };
        }
        return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
    } catch (error) {
        return { success: false, messaggio: `❌ Errore: ${error.message}` };
    }
}

// ============================================================
// 📋 COMANDO: LISTA PRENOTAZIONI
// ============================================================
async function listaPrenotazioni() {
    const data = await caricaDati();
    const prenotazioni = data.prenotazioni || [];
    const auto = data.auto || [];

    if (prenotazioni.length === 0) {
        return { success: false, messaggio: '📋 **Nessuna prenotazione.**' };
    }

    let testo = '📋 **Lista prenotazioni:**\n\n';
    prenotazioni.slice(0, 10).forEach((p) => {
        const autoNome = auto.find(a => a.id === p.autoId);
        const statoEmoji = p.stato === 'confermata' ? '🟢' : p.stato === 'annullata' ? '🔴' : '🟡';
        testo += `**${p.id}.** ${autoNome ? autoNome.marca + ' ' + autoNome.modello : 'Auto #' + p.autoId} - ${p.nome} ${p.cognome} - ${statoEmoji} ${p.stato}\n`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xff66cc)
        .setTitle('📋 Lista prenotazioni')
        .setDescription(testo)
        .setFooter({ text: `Totale: ${prenotazioni.length} prenotazioni` })
        .setTimestamp();
    return { success: true, embed: embed };
}

// ============================================================
// ✅ COMANDO: CONFERMA PRENOTAZIONE
// ============================================================
async function confermaPrenotazione(parts, username) {
    if (parts.length < 2) {
        return { success: false, messaggio: '❌ Formato: /conferma-prenotazione id\nEsempio: /conferma-prenotazione 2' };
    }

    try {
        const data = await caricaDati();
        const prenotazioni = data.prenotazioni || [];
        const id = parseInt(parts[1]);

        if (isNaN(id)) {
            return { success: false, messaggio: '❌ ID deve essere un numero!' };
        }

        const index = prenotazioni.findIndex(p => p.id === id);
        if (index === -1) {
            return { success: false, messaggio: `❌ Prenotazione con ID ${id} non trovata.` };
        }

        if (prenotazioni[index].stato === 'confermata') {
            return { success: false, messaggio: `❌ Prenotazione già confermata.` };
        }

        prenotazioni[index].stato = 'confermata';
        data.prenotazioni = prenotazioni;

        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Prenotazione confermata!')
                .setDescription(`📅 Prenotazione ID: ${id}`)
                .setFooter({ text: `Confermata da: ${username}` })
                .setTimestamp();
            return { success: true, embed: embed };
        }
        return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
    } catch (error) {
        return { success: false, messaggio: `❌ Errore: ${error.message}` };
    }
}

// ============================================================
// ❌ COMANDO: ANNULLA PRENOTAZIONE
// ============================================================
async function annullaPrenotazione(parts, username) {
    if (parts.length < 2) {
        return { success: false, messaggio: '❌ Formato: /annulla-prenotazione id\nEsempio: /annulla-prenotazione 2' };
    }

    try {
        const data = await caricaDati();
        const prenotazioni = data.prenotazioni || [];
        const id = parseInt(parts[1]);

        if (isNaN(id)) {
            return { success: false, messaggio: '❌ ID deve essere un numero!' };
        }

        const index = prenotazioni.findIndex(p => p.id === id);
        if (index === -1) {
            return { success: false, messaggio: `❌ Prenotazione con ID ${id} non trovata.` };
        }

        if (prenotazioni[index].stato === 'annullata') {
            return { success: false, messaggio: `❌ Prenotazione già annullata.` };
        }

        prenotazioni[index].stato = 'annullata';
        data.prenotazioni = prenotazioni;

        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Prenotazione annullata!')
                .setDescription(`📅 Prenotazione ID: ${id}`)
                .setFooter({ text: `Annullata da: ${username}` })
                .setTimestamp();
            return { success: true, embed: embed };
        }
        return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
    } catch (error) {
        return { success: false, messaggio: `❌ Errore: ${error.message}` };
    }
}

// ============================================================
// ❓ COMANDO: HELP
// ============================================================
function help() {
    const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('📖 Comandi disponibili - Outlet Usato Garantito')
        .setDescription('Ecco tutti i comandi che puoi usare:')
        .addFields(
            { name: '🚗 Gestione Auto', value: 
                '`/aggiungi-auto marca modello anno prezzo km alimentazione cambio`\n' +
                '`/modifica-auto id marca modello anno prezzo km alimentazione cambio`\n' +
                '`/elimina-auto id`\n' +
                '`/lista-auto`' },
            { name: '📅 Gestione Prenotazioni', value:
                '`/prenota-auto id nome cognome email telefono data`\n' +
                '`/lista-prenotazioni`\n' +
                '`/conferma-prenotazione id`\n' +
                '`/annulla-prenotazione id`' },
            { name: '❓ Help', value: '`/help` o `/aiuto` - Mostra questo messaggio' }
        )
        .setFooter({ text: 'Outlet Usato Garantito' })
        .setTimestamp();
    return { success: true, embed: embed };
}

// ============================================================
// 📦 GESTIONE MESSAGGI
// ============================================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (CANALE_COMANDI && CANALE_COMANDI !== 'ID_CANALE_DISCORD') {
        if (message.channel.id !== CANALE_COMANDI) return;
    }
    if (!message.content.startsWith('/')) return;

    const parts = message.content.split(' ');
    const cmd = parts[0].toLowerCase();
    const username = message.author.username;

    let risultato;

    try {
        if (cmd === '/aggiungi-auto') {
            risultato = await aggiungiAuto(parts, username);
        } else if (cmd === '/modifica-auto') {
            risultato = await modificaAuto(parts, username);
        } else if (cmd === '/elimina-auto') {
            risultato = await eliminaAuto(parts, username);
        } else if (cmd === '/lista-auto') {
            risultato = await listaAuto();
        } else if (cmd === '/prenota-auto') {
            risultato = await prenotaAuto(parts, username);
        } else if (cmd === '/lista-prenotazioni') {
            risultato = await listaPrenotazioni();
        } else if (cmd === '/conferma-prenotazione') {
            risultato = await confermaPrenotazione(parts, username);
        } else if (cmd === '/annulla-prenotazione') {
            risultato = await annullaPrenotazione(parts, username);
        } else if (cmd === '/help' || cmd === '/aiuto') {
            risultato = help();
        } else {
            risultato = { 
                success: false, 
                messaggio: '❌ Comando non riconosciuto. Usa `/help` per vedere i comandi disponibili.' 
            };
        }

        if (risultato.success && risultato.embed) {
            await message.reply({ embeds: [risultato.embed] });
        } else if (risultato.success && risultato.messaggio) {
            await message.reply(risultato.messaggio);
        } else {
            await message.reply(risultato.messaggio || '❌ Errore sconosciuto');
        }
    } catch (error) {
        console.error('❌ Errore:', error);
        await message.reply('❌ Si è verificato un errore durante l\'elaborazione del comando.');
    }
});

// ============================================================
// ✅ AVVIO BOT
// ============================================================
client.on('ready', () => {
    console.log(`✅ Bot avviato!`);
    console.log(`📢 Connesso come: ${client.user.tag}`);
    console.log(`📚 COMANDI DISPONIBILI:`);
    console.log(`   🚗 Gestione Auto:`);
    console.log(`      /aggiungi-auto marca modello anno prezzo km alimentazione cambio`);
    console.log(`      /modifica-auto id marca modello anno prezzo km alimentazione cambio`);
    console.log(`      /elimina-auto id`);
    console.log(`      /lista-auto`);
    console.log(`   📅 Gestione Prenotazioni:`);
    console.log(`      /prenota-auto id nome cognome email telefono data`);
    console.log(`      /lista-prenotazioni`);
    console.log(`      /conferma-prenotazione id`);
    console.log(`      /annulla-prenotazione id`);
    console.log(`   ❓ /help`);
    console.log(`🔗 Invita il bot con: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=3072`);
});

client.login(TOKEN);
