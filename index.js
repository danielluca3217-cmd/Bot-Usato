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
    process.exit(1);
}
if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    console.error('❌ ERRORE: JSONBIN_BIN_ID o JSONBIN_API_KEY non trovati!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});
// Nota: con le Slash Command native NON servono più GuildMessages/MessageContent,
// perché il bot non legge più i messaggi di testo, solo le interazioni.

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

// 🔒 Controlla se chi ha lanciato l'interazione ha il ruolo staff
function haRuoloStaff(interaction) {
    if (!interaction.member || !interaction.member.roles) return false;
    return interaction.member.roles.cache.some(role => role.name === RUOLO_STAFF);
}

// ============================================================
// COMANDI (ricevono un oggetto opts con i parametri già validati da Discord)
// ============================================================

async function aggiungiAuto(opts, username) {
    const data = await caricaDati();
    const auto = data.auto || [];
    const { marca, modello, anno, prezzo, km, alimentazione, cambio } = opts;
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
        return { success: true, embed };
    }
    return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
}

async function modificaAuto(opts, username) {
    const data = await caricaDati();
    const auto = data.auto || [];
    const { id, marca, modello, anno, prezzo, km, alimentazione, cambio } = opts;
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
        return { success: true, embed };
    }
    return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
}

async function eliminaAuto(opts, username) {
    const data = await caricaDati();
    const auto = data.auto || [];
    const { id } = opts;
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
        return { success: true, embed };
    }
    return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
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
    return { success: true, embed };
}

async function prenotaAuto(opts, username) {
    const data = await caricaDati();
    const auto = data.auto || [];
    const prenotazioni = data.prenotazioni || [];
    const { id, nome, cognome, email, telefono, data: dataPrenotazione } = opts;
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
        return { success: true, embed };
    }
    return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
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
    return { success: true, embed };
}

async function confermaPrenotazione(opts, username) {
    const data = await caricaDati();
    const prenotazioni = data.prenotazioni || [];
    const { id } = opts;
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
        return { success: true, embed };
    }
    return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
}

async function annullaPrenotazione(opts, username) {
    const data = await caricaDati();
    const prenotazioni = data.prenotazioni || [];
    const { id } = opts;
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
        return { success: true, embed };
    }
    return { success: false, messaggio: '❌ Errore durante il salvataggio.' };
}

function help() {
    const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('📖 Comandi disponibili')
        .addFields(
            { name: '🚗 Gestione Auto (solo staff)', value:
                '`/aggiungi-auto` `/modifica-auto` `/elimina-auto`\n`/lista-auto` (per tutti)' },
            { name: '📅 Gestione Prenotazioni', value:
                '`/prenota-auto` `/lista-prenotazioni` (per tutti)\n`/conferma-prenotazione` `/annulla-prenotazione` (solo staff)' },
            { name: '❓ Help', value: '`/help`' }
        )
        .setFooter({ text: 'Outlet Usato Garantito' })
        .setTimestamp();
    return { success: true, embed };
}

// Comandi che richiedono il ruolo staff
const COMANDI_STAFF = [
    'aggiungi-auto',
    'modifica-auto',
    'elimina-auto',
    'conferma-prenotazione',
    'annulla-prenotazione'
];

// ============================================================
// GESTIONE INTERAZIONI (Slash Command native)
// ============================================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const cmd = interaction.commandName;
    const username = interaction.user.username;

    if (COMANDI_STAFF.includes(cmd) && !haRuoloStaff(interaction)) {
        await interaction.reply({
            content: `❌ Non hai i permessi per usare questo comando. Serve il ruolo **${RUOLO_STAFF}**.`,
            ephemeral: true
        });
        return;
    }

    // Discord fa timeout dopo 3s: "difeririamo" subito la risposta per avere più tempo
    await interaction.deferReply();

    let risultato;
    try {
        const opts = {};
        interaction.options.data.forEach(o => { opts[o.name] = o.value; });

        if (cmd === 'aggiungi-auto') risultato = await aggiungiAuto(opts, username);
        else if (cmd === 'modifica-auto') risultato = await modificaAuto(opts, username);
        else if (cmd === 'elimina-auto') risultato = await eliminaAuto(opts, username);
        else if (cmd === 'lista-auto') risultato = await listaAuto();
        else if (cmd === 'prenota-auto') risultato = await prenotaAuto(opts, username);
        else if (cmd === 'lista-prenotazioni') risultato = await listaPrenotazioni();
        else if (cmd === 'conferma-prenotazione') risultato = await confermaPrenotazione(opts, username);
        else if (cmd === 'annulla-prenotazione') risultato = await annullaPrenotazione(opts, username);
        else if (cmd === 'help') risultato = help();
        else risultato = { success: false, messaggio: '❌ Comando non riconosciuto.' };

        if (risultato.embed) {
            await interaction.editReply({ embeds: [risultato.embed] });
        } else {
            await interaction.editReply(risultato.messaggio || '❌ Errore sconosciuto');
        }
    } catch (error) {
        console.error('❌ Errore:', error);
        await interaction.editReply('❌ Si è verificato un errore.');
    }
});

client.on('clientReady', () => {
    console.log(`✅ Bot avviato con successo!`);
    console.log(`📢 Connesso come: ${client.user.tag}`);
    console.log(`🔒 Ruolo staff: ${RUOLO_STAFF}`);
});

client.login(TOKEN).catch(error => {
    console.error('❌ Errore login:', error.message);
    process.exit(1);
});
