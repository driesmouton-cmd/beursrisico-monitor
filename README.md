# Beursrisico Monitor — S&P 500 & STOXX Europe 600

## Wat krijg je?
Een zelfstandige website met een doorzoekbare risicolijst (19 actieve ondernemingen en 4 kandidaten op 11 oktober 2026), brongebonden nieuwsblog, risicosignalen, historische gebeurtenissen en een beheerscherm. Ontworpen om als **nieuwe, aparte Netlify-site** te gebruiken naast de bestaande SMA200-barometer.

## Essentieel: twee verschillende publicatiemethoden

**Alleen demo (zonder automatische monitoring):** als je alleen `public/` naar Netlify Drop sleept, zie je de volledige layout, 23 startnamen en vier historische bronartikelen. Het nieuwsoverzicht wordt **niet** automatisch bijgewerkt en het archief wordt dan niet op de server opgeslagen. De gele waarschuwing bovenaan maakt dit duidelijk.

**Volledig geautomatiseerd (aanbevolen):** Netlify moet de website **uit een Git-repository** bouwen zodat de Functions, de uurlijkse Scheduled Function en de Netlify Blobs opslag actief worden. Gebruik daarvoor deze stappen:

1. Pak `beursrisico_monitor_compleet.zip` uit.
2. Maak op [GitHub](https://github.com/new) een nieuwe, lege repository (bv. `beursrisico-monitor`). Upload **de inhoud** van de uitgepakte map (dus `public/`, `netlify/`, `package.json`, `netlify.toml`, enzovoort). Upload de ZIP niet als één enkel bestand.
3. Ga in [Netlify](https://app.netlify.com/) naar **Add new project → Import an existing project → GitHub**, autoriseer de koppeling en kies deze repository. Gebruik bij de build-instellingen `Publish directory: public`. Laat het build-commando leeg. De configuratie uit `netlify.toml` bevat ook de Functions-map.
4. Wacht op de productie-deploy. Netlify geeft een `netlify.app`-adres. In **Functions** moet `scan-news` als **Scheduled** zichtbaar zijn (eenmaal per uur). De eerste scan kun je in Functions met **Run now** uitvoeren; anders wacht je tot de eerstvolgende uurgrens.
5. Open het dashboard; de gele demonstratiewaarschuwing verandert na een geslaagde scan in een groene statusregel. Zie je alleen een gele melding, controleer **Functions → scan-news → Logs** en `https://jouw-site.netlify.app/api/status`.
6. Voor bewerken: Netlify → **Project configuration → Environment variables** → voeg `MONITOR_ADMIN_TOKEN` toe met een lange, unieke geheime waarde (bv. 24+ willekeurige tekens). Voeg deze waarde **niet** toe aan code of GitHub. Na het instellen kan een nieuwe deploy nodig zijn. Voer de waarde in onder de tab **Beheer**.

Gebruik bij voorkeur een **aparte site**; upload deze niet op de bestaande SMA200-site, dan zou die vervangen worden.

### Uurlijkse monitoring
- Elk uur worden maximaal **vier ondernemingen** in een roulatie gecontroleerd. Met 23 ondernemingen komt elke naam ongeveer om de **zes uur** aan de beurt. Dat is **geen realtime newswire**.
- Bron: [GDELT DOC API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/), laatste 48 uur, maximaal 8 artikelen per aandeel per scan. GDELT is gratis maar externe toegang of quota kunnen tijdelijk falen. Geen API-sleutel vereist.
- Gevonden brontitels worden automatisch en grof geclassificeerd als risico/positief/gemengd. Er is **geen semantische AI-beoordeling, factchecking of zekerheid dat iedere titel echt relevant is**. De gebruiker kan doorklikken naar het oorspronkelijke artikel.
- De startartikelen zijn historische **handmatig geselecteerde Reuters-bronnen** en worden als zodanig getoond.
- Opgeslagen berichten worden gededupliceerd en per maand gearchiveerd in een **site-wide Netlify Blobs-store**. De laatste 500 worden ook sneller bereikbaar gehouden. Bestaande archieven blijven behouden bij een nieuwe deployment van dezelfde site.
- Kandidaten worden automatisch toegevoegd aan de actieve risicolijst bij minstens drie risicoartikelen van twee verschillende nieuwswebsites in zeven dagen. Na 30 dagen zonder negatieve signalen kunnen ze weer uit de actieve lijst gaan. De vaste kernlijst wordt niet automatisch verwijderd, maar kan via Beheer gewijzigd worden.
- De term 'verhoogd risico' is een transparante **heuristiek** op basis van indexinvloed, risicokanalen en titels, **geen financiële waarschijnlijkheidsberekening**.
- Indexgewichten: S&P 500 (SPY/index top holdings 7 oktober 2026), STOXX Europe 600 (Invesco top holdings 1 oktober 2026). Dit zijn momentopnamen. Ontbrekende gewichten zijn bewust leeg; niet nul. Automatische gewichtsupdate en complete dekking van alle circa 1.100 indexnamen vereisen een aanvullende, betrouwbare gegevensleverancier.

### Uitleg van tabbladen
- **Overzicht:** bedrijven filteren op land/risico/zoekterm, risicorationale, recent nieuws.
- **Nieuwsarchief:** tijdlijn, filter op bedrijf, type nieuws, zoekwoord en maand; originele links.
- **Risicolijst & historie:** kandidaten en logboek van promoties of terugschalingen.
- **Beheer:** met geheime serverbeheersleutel basisniveau en beschrijving aanpassen en kandidaten toevoegen.
- **Methode:** beperkingen en bronvermelding.

### Privacy & security
De website is publiek als je de standaard Netlify URL deelt; dus ook de nieuwsarchiefpagina. De beheer-API vereist `MONITOR_ADMIN_TOKEN`, dat uitsluitend als environment variable bij Netlify staat. Gebruik geen beursaccount-wachtwoord als beheersleutel. Het beheerformulier houdt de sleutel alleen in het geheugen van de webpagina. Netlify Blobs is geen relationele database en heeft geen ingebouwde transactievergrendeling; voor een groter professioneel archief is een echte database aan te raden. De monitoring is een prototype en moet na livegang op betrouwbaarheid worden gecontroleerd.

### Testen met Node.js
`npm install` gevolgd door `npm test` werkt voor unit tests als je een script `test` toevoegt, of gebruik direct `node --test tests/*.test.mjs`. Voor lokale functie-uitvoering: `npx netlify dev` (vereist aanmelding bij je Netlify-account voor Blobs).

### Bronnen van de oorspronkelijke lijst
- S&P 500 indexgewichten: https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy
- STOXX 600 indexgewichten: https://www.invesco.com/nl/en/financial-products/etfs/invesco-stoxx-europe-600-ucits-etf-acc.html
- Reuters AI-financiering: https://www.reuters.com/world/china/global-markets-view-europe-2026-10-09/
- Reuters Europese rente: https://www.reuters.com/markets/europe/european-shares-slip-after-three-day-gain-rise-oil-yields-weigh-2026-10-07/
- Reuters Franse begroting: https://www.reuters.com/markets/europe/european-shares-rise-after-last-weeks-selloff-french-stocks-lag-2026-10-05/
- Reuters Europese resultaten: https://www.reuters.com/business/european-majors-strong-earnings-growth-expected-have-continued-q3-2026-10-09/

## Wat nog niet ingebouwd is
- Automatische verificatie van alle indexsamenstellingen en gewichten.
- Geautomatiseerde volledige financiële analyse van het risico op daling, analistenconsensus, kredietspreads en echte koers/earnings-signalen.
- Pushnotificaties of e-mails bij hoog risico.
- Gegarandeerde onbeperkte nieuwsdekking en redactionele validatie.
