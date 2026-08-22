const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// 🔧 LEGGE TOKEN E CHIAVI DALLE VARIABILI D'AMBIENTE
const TOKEN = process.env.DISCORD_TOKEN;
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

// 🔒 Nome del ruolo Discord autorizzato a modificare i dati
const RUOLO_STAFF = 'Concessionario Usato';

// CONTROLLA CHE LE VARIABILI CI SIANO
if (!TOKEN) {
    console.error('❌ ERRORE: DISCORD_TOKEN non trovato!');
    console.log('📌 Aggiungi DISCORD_TOKEN nelle variabili d\'ambiente su Railway.');
    process.exit(1);
}
if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    console.error('❌ ERRORE: JSONBIN_BIN_ID o JSONBIN_API_KEY non trovati!');
    console.log('📌 Aggiungi JSONBIN_BIN_ID e JSONBIN_API_KEY nelle variabili d\'ambiente su Railway.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// FUNZIONI DATABASE
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
        await axios.put(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, dati, {
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            }
        });
        return true;
    } catch (error) {
        console.error('❌ Errore salvataggio:', error.message);
        return false;
    }
}

function isAutoPrenotata(autoId, prenotazioni) {
    return prenotazioni.some(p => p.autoId === autoId && p.stato === 'confermata');
}

// 🔒 Controlla se l'utore del messaggio ha il ruolo staff
function haRuoloStaff(message) {
    if (!message.member) return false;
    return message.member.roles.cache.some(role => role.name === RUOLO_STAFF);
}

// ============================================================
// COMANDI
// ============================================================

async function aggiungiAuto(parts, username) {
    if (parts.length < 8) {
        return { success: false, messaggio: '❌ Formato: /aggiungi-auto marca modello anno prezzo km alimentazione cambio' };
    }
    try {
        const data = await caricaDati();
        const auto = data.auto || [];
        const marca = parts[1], modello = parts[2];
        const anno = parseInt(parts[3]), prezzo = parseInt(parts[4]), km = parseInt(parts[5]);
        const alimentazione = parts[6], cambio = parts.slice(7).join(' ');
        if (isNaN(anno) || isNaN(prezzo) || isNaN(km)) {
            return { success: false, messaggio: '❌ Anno, prezzo e km devono essere numeri!' };
        }
        const newId = auto.length > 0 ? Math.max(...auto.map(a => a.id)) + 1 : 1;
        auto.push({ id: newId, marca, modello, anno, prezzo, km, alimentazione, cambio });
        data.auto = auto;
        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Auto aggiunta!')
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

async function modificaAuto(parts, username) {
    if (parts.length < 9) {
        return { success: false, messaggio: '❌ Formato: /modifica-auto id marca modello anno prezzo km alimentazione cambio' };
    }
    try {
        const data = await caricaDati();
        const auto = data.auto || [];
        const id = parseInt(parts[1]), marca = parts[2], modello = parts[3];
        const anno = parseInt(parts[4]), prezzo = parseInt(parts[5]), km = parseInt(parts[6]);
        const alimentazione = parts[7], cambio = parts.slice(8).join(' ');
        if (isNaN(id) || isNaN(anno) || isNaN(prezzo) || isNaN(km)) {
            return { success: false, messaggio: '❌ ID, anno, prezzo e km devono essere numeri!' };
        }
        const index = auto.findIndex(a => a.id === id);
        if (index === -1) return { success: false, messaggio: `❌ Auto con ID ${id} non trovata.` };
        if (isAutoPrenotata(id, data.prenotazioni || [])) {
            return { success: false, messaggio: `❌ L'auto con ID ${id} è prenotata!` };
        }
        auto[index] = { ...auto[index], marca, modello, anno, prezzo, km, alimentazione, cambio };
        data.auto = auto;
        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0xff9900)
                .setTitle('✏️ Auto modificata!')
                .setDescription(`🚗 **${marca} ${modello}** (ID: ${id})`)
                .addFields(
                    { name: '📅 Anno', value: String(anno), inline: true },
                    { name: '💰 Prezzo', value: `€ ${prezzo.toLocaleString()}`, inline: true },
                    { name: '📏 Km', value: `${km.toLocaleString()} km`, inline: true }
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

async function eliminaAuto(parts, username) {
    if (parts.length < 2) {
        return { success: false, messaggio: '❌ Formato: /elimina-auto id' };
    }
    try {
        const data = await caricaDati();
        const auto = data.auto || [];
        const id = parseInt(parts[1]);
        if (isNaN(id)) return { success: false, messaggio: '❌ ID deve essere un numero!' };
        const index = auto.findIndex(a => a.id === id);
        if (index === -1) return { success: false, messaggio: `❌ Auto con ID ${id} non trovata.` };
        if (isAutoPrenotata(id, data.prenotazioni || [])) {
            return { success: false, messaggio: `❌ L'auto con ID ${id} è prenotata!` };
        }
        const autoEliminata = auto[index];
        auto.splice(index, 1);
        data.auto = auto;
        if (await salvaDati(data)) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🗑️ Auto eliminata!')
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

async function listaAuto() {
    const data = await caricaDati();
    const auto = data.auto || [];
    const prenotazioni = data.prenotazioni || [];
    if (auto.length === 0) return { success: false, messaggio: '📋 **Nessuna auto disponibile.**' };
    let testo = '📋 **Lista auto disponibili:**\n\n';
    auto.slice(0, 15).forEach(a => {
        const prenotata = isAutoPrenotata(a.id, prenotazioni) ? ' 🔒 PRENOTATA' : '';
        testo += `**${a.id}.** ${a.marca} ${a.modello} - € ${a.prezzo.toLocaleString()} - ${a.anno} - ${a.km}km${prenotata}\n`;
    });
    if (auto.length > 15) testo += `\n... e altre ${auto.length - 15} auto`;
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📋 Lista auto')
        .setDescription(testo)
        .setFooter({ text: `Totale: ${auto.length} auto` })
        .setTimestamp();
    return { success: true, embed: embed };
}

async function prenotaAuto(parts, username) {
    if (parts.length < 8) {
        return { success: false, messaggio: '❌ Formato: /prenota-auto id nome cognome email telefono data' };
    }
    try {
        const data = await caricaDati();
        const auto = data.auto || [];
        const prenotazioni = data.prenotazioni || [];
        const id = parseInt(parts[1]), nome = parts[2], cognome = parts[3];
        const email = parts[4], telefono = parts[5], dataPrenotazione = parts[6];
        if (isNaN(id)) return { success: false, messaggio: '❌ ID deve essere un numero!' };
        const autoEsiste = auto.find(a => a.id === id);
        if (!autoEsiste) return { success: false, messaggio: `❌ Auto con ID ${id} non trovata.` };
        if (isAutoPrenotata(id, prenotazioni)) {
            return { success: false, messaggio: `❌ L'auto ${autoEsiste.marca} ${autoEsiste.modello} è già prenotata!` };
        }
        const nuovaPrenotazione = {
            id: Date.now(),
            autoId: id,
            nome, cognome, email, telefono,
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

async function listaPrenotazioni() {
    const data = await caricaDati();
    const prenotazioni = data.prenotazioni || [];
    const auto = data.auto || [];
    if (prenotazioni.length === 0) return { success: false, messaggio: '📋 **Nessuna prenotazione.**' };
    let testo = '📋 **Lista prenotazioni:**\n\n';
    prenotazioni.slice(0, 10).forEach(p => {
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

async function confermaPrenotazione(parts, username) {
    if (parts.length < 2) return { success: false, messaggio: '❌ Formato: /conferma-prenotazione id' };
    try {
        const data = await caricaDati();
        const prenotazioni = data.prenotazioni || [];
        const id = parseInt(parts[1]);
        if (isNaN(id)) return { success: false, messaggio: '❌ ID deve essere un numero!' };
        const index = prenotazioni.findIndex(p => p.id === id);
        if (index === -1) return { success: false, messaggio: `❌ Prenotazione con ID ${id} non trovata.` };
        if (prenotazioni[index].stato === 'confermata') return { success: false, messaggio: `❌ Prenotazione già confermata.` };
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

async function annullaPrenotazione(parts, username) {
    if (parts.length < 2) return { success: false, messaggio: '❌ Formato: /annulla-prenotazione id' };
    try {
        const data = await caricaDati();
        const prenotazioni = data.prenotazioni || [];
        const id = parseInt(parts[1]);
        if (isNaN(id)) return { success: false, messaggio: '❌ ID deve essere un numero!' };
        const index = prenotazioni.findIndex(p => p.id === id);
        if (index === -1) return { success: false, messaggio: `❌ Prenotazione con ID ${id} non trovata.` };
        if (prenotazioni[index].stato === 'annullata') return { success: false, messaggio: `❌ Prenotazione già annullata.` };
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

function help() {
    const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('📖 Comandi disponibili')
        .addFields(
            { name: '🚗 Gestione Auto (solo staff)', value: 
                '`/aggiungi-auto marca modello anno prezzo km alimentazione cambio`\n' +
                '`/modifica-auto id marca modello anno prezzo km alimentazione cambio`\n' +
                '`/elimina-auto id`\n' +
                '`/lista-auto`' },
            { name: '📅 Gestione Prenotazioni', value:
                '`/prenota-auto id nome cognome email telefono data`\n' +
                '`/lista-prenotazioni`\n' +
                '`/conferma-prenotazione id` (solo staff)\n' +
                '`/annulla-prenotazione id` (solo staff)' },
            { name: '❓ Help', value: '`/help` o `/aiuto`' }
        )
        .setFooter({ text: 'Outlet Usato Garantito' })
        .setTimestamp();
    return { success: true, embed: embed };
}

// Comandi che richiedono il ruolo staff
const COMANDI_STAFF = [
    '/aggiungi-auto',
    '/modifica-auto',
    '/elimina-auto',
    '/conferma-prenotazione',
    '/annulla-prenotazione'
];

// ============================================================
// GESTIONE MESSAGGI
// ============================================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('/')) return;

    const parts = message.content.split(' ');
    const cmd = parts[0].toLowerCase();
    const username = message.author.username;

    // 🔒 Controllo permessi sui comandi riservati allo staff
    if (COMANDI_STAFF.includes(cmd) && !haRuoloStaff(message)) {
        await message.reply(`❌ Non hai i permessi per usare questo comando. Serve il ruolo **${RUOLO_STAFF}**.`);
        return;
    }

    let risultato;

    try {
        if (cmd === '/aggiungi-auto') risultato = await aggiungiAuto(parts, username);
        else if (cmd === '/modifica-auto') risultato = await modificaAuto(parts, username);
        else if (cmd === '/elimina-auto') risultato = await eliminaAuto(parts, username);
        else if (cmd === '/lista-auto') risultato = await listaAuto();
        else if (cmd === '/prenota-auto') risultato = await prenotaAuto(parts, username);
        else if (cmd === '/lista-prenotazioni') risultato = await listaPrenotazioni();
        else if (cmd === '/conferma-prenotazione') risultato = await confermaPrenotazione(parts, username);
        else if (cmd === '/annulla-prenotazione') risultato = await annullaPrenotazione(parts, username);
        else if (cmd === '/help' || cmd === '/aiuto') risultato = help();
        else risultato = { success: false, messaggio: '❌ Comando non riconosciuto. Usa `/help`' };

        if (risultato.success && risultato.embed) {
            await message.reply({ embeds: [risultato.embed] });
        } else if (risultato.success && risultato.messaggio) {
            await message.reply(risultato.messaggio);
        } else {
            await message.reply(risultato.messaggio || '❌ Errore sconosciuto');
        }
    } catch (error) {
        console.error('❌ Errore:', error);
        await message.reply('❌ Si è verificato un errore.');
    }
});

client.on('ready', () => {
    console.log(`✅ Bot avviato con successo!`);
    console.log(`📢 Connesso come: ${client.user.tag}`);
    console.log(`🔒 Ruolo staff: ${RUOLO_STAFF}`);
    console.log(`📚 COMANDI DISPONIBILI:`);
    console.log(`   /aggiungi-auto marca modello anno prezzo km alimentazione cambio`);
    console.log(`   /modifica-auto id marca modello anno prezzo km alimentazione cambio`);
    console.log(`   /elimina-auto id`);
    console.log(`   /lista-auto`);
    console.log(`   /prenota-auto id nome cognome email telefono data`);
    console.log(`   /lista-prenotazioni`);
    console.log(`   /conferma-prenotazione id`);
    console.log(`   /annulla-prenotazione id`);
    console.log(`   /help`);
});

client.login(TOKEN).catch(error => {
    console.error('❌ Errore login:', error.message);
    process.exit(1);
});
