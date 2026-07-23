// Every rider-facing string lives here in English and Shona from the start. No
// hardcoded copy in components. Hwindi is the local word for conductor and is
// used deliberately. Keep entries short, second-person and concrete.
import type { AppLanguage } from "@svika/shared";

export const LANG_COOKIE = "svika_lang";

// The languages a rider can actually switch to today. Ndebele is roadmap, not
// a live language, so it is deliberately absent here: the toggle renders it as
// a disabled "coming soon" chip that switches nothing. See docs/DISCLOSURE-REGISTER.md.
export const LIVE_LANGUAGES: readonly AppLanguage[] = ["en", "sn"];

type Entry = { en: string; sn: string };

export const dict = {
  "brand.tagline": {
    en: "Ride Harare. Keep your change.",
    sn: "Ride Harare. Keep your change.",
  },
  "nav.signIn": { en: "Sign in", sn: "Sign in" },

  "landing.headline1": { en: "Beyond the", sn: "Beyond the" },
  "landing.headlineWord": { en: "Kombi", sn: "Kombi" },
  "landing.body": {
    en: "Plan every trip, get smart suggestions before you leave, and ride with your safety looked after.",
    sn: "Ronga rwendo rwako, wana mazano usati wasimuka, uye famba wakachengeteka.",
  },
  "landing.cta": { en: "Find your kombi", sn: "Tsvaga kombi yako" },
  "landing.signinHint": {
    en: "Hwindi or fleet owner?",
    sn: "Hwindi or fleet owner?",
  },
  "landing.signinLink": { en: "Sign in here", sn: "Sign in here" },

  "demo.chip": { en: "Demo account", sn: "Akaunti yedemo" },

  "login.title": { en: "Sign in to Svika", sn: "Sign in to Svika" },
  "login.phoneLabel": { en: "Phone number", sn: "Phone number" },
  "login.send": { en: "Send code", sn: "Send code" },
  "login.sending": { en: "Sending…", sn: "Sending…" },
  "login.codeLabel": {
    en: "Enter the 6-digit code",
    sn: "Enter the 6-digit code",
  },
  "login.verify": { en: "Verify", sn: "Verify" },
  "login.verifying": { en: "Verifying…", sn: "Verifying…" },
  "login.resend": { en: "Send a new code", sn: "Send a new code" },
  "login.codeSentTo": { en: "We sent a code to", sn: "We sent a code to" },
  "login.errPhone": {
    en: "Enter a valid phone number.",
    sn: "Enter a valid phone number.",
  },
  "login.errCode": {
    en: "That code did not work. Try again.",
    sn: "That code did not work. Try again.",
  },

  "app.welcome": { en: "Welcome", sn: "Titambire" },
  "app.roleLabel": { en: "Your role", sn: "Basa rako" },
  "app.phoneLabel": { en: "Phone", sn: "Foni" },
  "app.signOut": { en: "Sign out", sn: "Sign out" },

  "role.rider": { en: "Rider", sn: "Mufambi" },
  "role.owner": { en: "Owner", sn: "Muridzi" },
  "role.conductor": { en: "Conductor", sn: "Hwindi" },

  "common.back": { en: "Back", sn: "Back" },
  "common.minutes": { en: "min", sn: "maminitsi" },
  "common.to": { en: "to", sn: "kusvika" },

  "rider.searchTitle": {
    en: "Where are you going?",
    sn: "Where are you going?",
  },
  "rider.fromLabel": { en: "From", sn: "Kubva" },
  "rider.toLabel": { en: "To", sn: "Kuenda" },
  "rider.fromPlaceholder": {
    en: "e.g. Heights, UZ, Market Square",
    sn: "sekuti Heights, UZ, Market Square",
  },
  "rider.toPlaceholder": {
    en: "e.g. Avondale, Sam Levy's, town",
    sn: "sekuti Avondale, Sam Levy's, town",
  },
  "rider.planCta": { en: "Plan my trip", sn: "Ronga rwendo rwangu" },
  "rider.walletBalance": { en: "Wallet credit", sn: "Mari muWallet" },
  "rider.tickets": { en: "Your tickets", sn: "Matikiti ako" },
  "rider.noTickets": {
    en: "No tickets yet. Plan a trip to get one.",
    sn: "Hapana matikiti. Ronga rwendo kuti utore tikiti.",
  },

  "plan.title": { en: "Your trip", sn: "Your trip" },
  "plan.sheetOpen": {
    en: "Show the legs of this trip",
    sn: "Wona zvikamu zverwendo urwu",
  },
  "plan.ride": { en: "Ride", sn: "Kufamba" },
  "plan.walk": { en: "Walk", sn: "Kufamba netsoka" },
  "plan.alightAt": { en: "Get off at", sn: "Burukira pa" },
  "plan.totalFare": { en: "Total fare", sn: "Mari yese" },
  "plan.about": { en: "About", sn: "Inoda kukwana" },
  "plan.boardings": { en: "kombis", sn: "makombi" },
  "plan.payWallet": { en: "Pay from wallet", sn: "Bhadhara newallet" },
  "plan.reserveCash": {
    en: "Reserve, pay cash on board",
    sn: "Bhuka, bhadhara cash mukombi",
  },
  "plan.pickFrom": {
    en: "Choose your starting stop",
    sn: "Sarudza paunokwirira",
  },
  "plan.pickTo": {
    en: "Choose where you are going",
    sn: "Sarudza kwaukuenda",
  },
  "plan.noMatch": {
    en: "We do not know that place yet. Pick a stop from the list.",
    sn: "Hatijaziva nzvimbo iyoyo. Sarudza pa stop pane list.",
  },
  "plan.noRoute": {
    en: "No route found between those stops yet.",
    sn: "Hapana route pama stop iwayo parizvino.",
  },
  "plan.insufficient": {
    en: "Not enough wallet credit. Reserve and pay cash on board.",
    sn: "Mari muWallet haikwane. Bhuka wobhadhara cash mukombi.",
  },

  // D1 destination first planning: the honest trade to a place, the plain
  // no service line, and the picker's place kinds
  "plan.dropAt": {
    en: "Drop at {stop}, then a {meters} m walk.",
    sn: "Buruka pa {stop}, wofamba {meters} m netsoka.",
  },
  "plan.noService": {
    en: "No kombi reaches {place} yet. The closest drop is {stop}, then a {meters} m walk.",
    sn: "Hapana kombi inosvika ku{place} parizvino. Chiteshi chiri pedyo ndi {stop}, wofamba {meters} m netsoka.",
  },
  "plan.walkArrive": {
    en: "to {place}",
    sn: "kusvika ku{place}",
  },
  "geo.kind.suburb": { en: "Suburb", sn: "Suburb" },
  "geo.kind.place": { en: "Place", sn: "Nzvimbo" },
  "geo.kind.poi": { en: "Landmark", sn: "Chiratidzo" },
  "geo.kind.road": { en: "Road", sn: "Mugwagwa" },

  "ticket.title": { en: "Board code", sn: "Board code" },
  "ticket.screenTitle": { en: "Your ticket", sn: "Your ticket" },
  "ticket.showHwindi": {
    en: "Show this code to the hwindi when you board.",
    sn: "Ratidza hwindi kodi iyi paunokwira.",
  },
  "ticket.fare": { en: "Fare", sn: "Mari yekufamba" },
  "ticket.payment": { en: "Payment", sn: "Kubhadhara" },
  "ticket.route": { en: "Route", sn: "Route" },
  "ticket.validUntil": { en: "Valid until", sn: "Inoshanda kusvika" },
  "ticket.payCash": { en: "Pay cash on board", sn: "Bhadhara cash mukombi" },
  "ticket.paidWallet": { en: "Paid from wallet", sn: "Yabhadharwa newallet" },
  "ticket.status.issued": { en: "Ready to board", sn: "Wagadzirira kukwira" },
  "ticket.status.redeemed": { en: "Cleared", sn: "Yabhadharwa" },
  "ticket.status.cancelled": { en: "Cancelled", sn: "Yakanzurwa" },
  "ticket.status.expired": { en: "Expired", sn: "Yapera nguva" },
  "ticket.status.refunded": { en: "Refunded", sn: "Yadzorerwa" },
  "ticket.legOf": { en: "Leg", sn: "Chikamu" },
  "ticket.status.loaded": { en: "On the kombi", sn: "Mukombi" },
  "ticket.status.collected": { en: "Collected", sn: "Yatorwa" },

  "wallet.title": { en: "Your wallet", sn: "Your wallet" },
  "wallet.balanceLabel": { en: "Balance", sn: "Mari yasara" },
  "wallet.changeChip": { en: "Change kept", sn: "Chenji yakachengetwa" },
  "wallet.changeTitle": {
    en: "Change kept as credit",
    sn: "Change kept as credit",
  },
  "wallet.changeTotal": { en: "Kept so far", sn: "Yachengetwa kusvika zvino" },
  "wallet.changeBody": {
    en: "When you pay cash and the hwindi cannot give change, the difference lands here as credit instead of leaving with the kombi.",
    sn: "Kana wabhadhara ne cash hwindi oshaya chenji, mari yacho inopinda muno muma credit panzvimbo pekuti iende nekombi.",
  },
  "wallet.changeNone": {
    en: "No change credited yet. The first time a hwindi owes you change, it lands here.",
    sn: "Hapana chenji yapinda parizvino. Hwindi akangosara nechenji yako, inopinda muno.",
  },
  "wallet.open": { en: "Wallet", sn: "Wallet" },
  "wallet.history": { en: "Recent activity", sn: "Zvichangobva kuitika" },
  "wallet.sendTitle": { en: "Send credit", sn: "Send credit" },
  "wallet.sendAmount": { en: "Amount", sn: "Mari yacho" },
  "wallet.sendCta": { en: "Send", sn: "Tumira" },
  "wallet.sendHint": {
    en: "You get a claim code to share. Unclaimed credit comes back when you cancel.",
    sn: "Unowana kodi yekutora mari yekushera. Mari isina kutorwa inodzoka ukaikanzura.",
  },
  "wallet.claimTitle": { en: "Claim credit", sn: "Claim credit" },
  "wallet.claimLabel": { en: "Claim code", sn: "Kodi yekutora mari" },
  "wallet.claimCta": { en: "Claim", sn: "Tora" },
  "wallet.claimed": { en: "Credit claimed", sn: "Mari yatorwa" },
  "wallet.claimInvalid": {
    en: "That code did not work.",
    sn: "Kodi iyoyo hairisi kushanda.",
  },
  "wallet.claimAlready": {
    en: "That code was already claimed.",
    sn: "Kodi iyoyo yakatoshandiswa kutora mari.",
  },
  "wallet.claimRateLimited": {
    en: "Too many tries. Wait 10 minutes.",
    sn: "Waedza kakawanda. Imbomirira 10 mins.",
  },
  "wallet.sent": { en: "Share this code", sn: "Shera kodi iyi" },
  "wallet.pending": { en: "Waiting to be claimed", sn: "Iri kumirira kutorwa" },
  "wallet.cancel": { en: "Cancel and take it back", sn: "Kanzura udzose mari yako" },
  "wallet.sendErr": {
    en: "Could not send. Check your balance.",
    sn: "Yaramba kutumirwa. Checka balance yako.",
  },
  "wallet.txn.topup": { en: "Top up", sn: "Top up" },
  "wallet.txn.ticket_purchase": { en: "Ticket", sn: "Tikiti" },
  "wallet.txn.fare_settlement": {
    en: "Fare settled",
    sn: "Mari yekufamba yabhadharwa",
  },
  "wallet.txn.change_credit": { en: "Change to credit", sn: "Chenji yava macredit" },
  "wallet.txn.transfer_send": { en: "Credit sent", sn: "Mari yatumirwa" },
  "wallet.txn.transfer_claim": { en: "Credit claimed", sn: "Mari yatorwa" },
  "wallet.txn.transfer_cancel": {
    en: "Transfer cancelled",
    sn: "Kutumira kwakanzurwa",
  },
  "wallet.txn.refund": { en: "Refund", sn: "Mari yadzorerwa" },
  "wallet.txn.adjustment": { en: "Adjustment", sn: "Kugadzirisa mari" },

  "parcel.title": { en: "Send a parcel", sn: "Send a parcel" },
  "parcel.open": { en: "Parcels", sn: "Mapasuru" },
  "parcel.route": { en: "Route", sn: "Route" },
  "parcel.from": { en: "Load at", sn: "Takira pa" },
  "parcel.to": { en: "Collect at", sn: "Torera pa" },
  "parcel.payWallet": { en: "Pay from wallet", sn: "Bhadhara newallet" },
  "parcel.payCash": { en: "Pay cash at loading", sn: "Bhadhara cash pakutakira" },
  "parcel.loadCode": { en: "LOAD code", sn: "Kodi YEKUTAKIRA" },
  "parcel.collectCode": { en: "COLLECT code", sn: "Kodi YEKUTORA" },
  "parcel.loadHint": {
    en: "Give the LOAD code with the parcel. Send the COLLECT code to the receiver.",
    sn: "Ipa hwindi Kodi YEKUTAKIRA nepasuru. Tumira Kodi YEKUTORA kune arikuigamuchira.",
  },
  "parcel.yours": { en: "Your parcels", sn: "Mapasuru ako" },
  "parcel.none": { en: "No parcels yet.", sn: "Hapana mapasuru parizvino." },
  "parcel.err": {
    en: "Could not book the parcel.",
    sn: "Pasuru yatadza kubhukiwa.",
  },
  "parcel.errBalance": {
    en: "Not enough wallet credit. Pay cash at loading instead.",
    sn: "Mari muWallet haikwane. Bhadhara cash pakutakira pasuru.",
  },

  "owner.title": { en: "Revenue", sn: "Revenue" },
  "owner.open": { en: "Owner view", sn: "Panoonera muridzi" },
  "owner.balance": { en: "Wallet balance", sn: "Mari iri muWallet" },
  "owner.day": { en: "Day", sn: "Zuva" },
  "owner.route": { en: "Route", sn: "Route" },
  "owner.tickets": { en: "Fares", sn: "Mari yekufamba" },
  "owner.gross": { en: "Gross", sn: "Mari yese yapinda" },
  "owner.commission": { en: "Hwindi", sn: "Hwindi" },
  "owner.net": { en: "Yours", sn: "Yako" },
  "owner.none": {
    en: "No settled digital fares yet.",
    sn: "Hapana mari dzema digital dzati dzabhadharwa.",
  },
  "owner.note": {
    en: "Every figure comes straight from the ledger. Cash fares stay with the crew and are not counted here.",
    sn: "Mari yese iripano inobva mu ledger. Mari ye cash inosara nemacrew haiverengwe pano.",
  },
  "owner.watchdog": { en: "Revenue watchdog", sn: "Murindi wemari yapinda" },
  "owner.watchdogSimulated": {
    en: "Simulated history",
    sn: "History yedemo",
  },
  "owner.watchdogSummary": {
    en: "{count} simulated days scanned, {flagged} flagged",
    sn: "Mazuva {count} e demo aongororwa, {flagged} aonekwa aine mhosho",
  },
  "owner.watchdogNone": {
    en: "No unusual days in the scanned history.",
    sn: "Hapana mazuva asinganzwisisike ma history.",
  },
  "owner.watchdogEmpty": {
    en: "No simulated history loaded yet.",
    sn: "Hapana history yedemo yati yaiswa.",
  },
  "owner.wdForest": {
    en: "Forest flagged this day",
    sn: "Sango rakadoma zuva iri",
  },
  "owner.wdThresholdSilent": {
    en: "the fixed threshold rule stayed silent",
    sn: "mutemo wakagadzikwa wakaramba wakanyarara",
  },
  "owner.wdThresholdFired": {
    en: "the fixed threshold rule also fired",
    sn: "mutemo wakagadzikwa wakadomawo",
  },
  "owner.watchdogNote": {
    en: "Flags describe patterns, never a person. This card runs on clearly labelled simulated history until the network has months of real fares.",
    sn: "Zviratidzo zvinotaura maitiro, kwete munhu. Kadhi iri rinoshanda nenhoroondo yakagadzirwa kusvika network yava nemwedzi yemari chaiyo.",
  },
  "owner.netToDate": { en: "Net to date", sn: "Yako yese" },
  "owner.chartTitle": {
    en: "Digital fares, last 14 days",
    sn: "Digital fares, last 14 days",
  },
  "owner.chartNet": { en: "Net in this window", sn: "Yako mumazuva aya" },
  "owner.routesTitle": { en: "By route", sn: "By route" },
  "owner.fares": { en: "fares", sn: "vafambi" },
  "owner.taxTitle": {
    en: "ZIMRA presumptive tax",
    sn: "ZIMRA presumptive tax",
  },
  "owner.taxBody": {
    en: "Kombis pay a flat monthly presumptive tax of $50 to $60, collected with the ZINARA licence. It is a fixed amount, not a share of takings.",
    sn: "Makombi anobhadhara mutero wakatarwa we$50 kusvika $60 pamwedzi, unotorwa nerezinesi reZINARA. Imari yakatarwa, kwete chikamu chemari inopinda.",
  },
  "owner.taxHint": {
    en: "Your statement is the digital record of what each kombi actually earned, ready for the conversation ZIMRA actually has.",
    sn: "Statement yako ndiyo chinyorwa chedijitari chemari yakapinda pakombi imwe neimwe.",
  },
  "owner.statementOpen": {
    en: "Print a statement",
    sn: "Dhinda statement",
  },

  "statement.title": { en: "Revenue statement", sn: "Revenue statement" },
  "statement.period": { en: "Period", sn: "Nguva" },
  "statement.generated": { en: "Generated", sn: "Yagadzirwa" },
  "statement.owner": { en: "Owner", sn: "Muridzi" },
  "statement.print": { en: "Print", sn: "Dhinda" },
  "statement.totals": { en: "Totals", sn: "Zvese" },
  "statement.note": {
    en: "Every figure derives from Svika's append only ledger of settled digital fares. Cash fares stay with the crew and are not counted. Presumptive tax for kombis is a flat $50 to $60 a month collected with the ZINARA licence; this statement is the earnings record beside it.",
    sn: "Nhamba dzese dzinobva mubhuku remari reSvika risingagadziridzwe. Cash inosara nevashandi haiverengwi. Mutero wemakombi imari yakatarwa ye$50 kusvika $60 pamwedzi inotorwa nerezinesi reZINARA; statement iyi ndiyo chinyorwa chemari yakapinda parutivi pawo.",
  },

  "home.sheetHint": {
    en: "Type in Shona or English.",
    sn: "Nyora neShona kana Chirungu.",
  },
  "home.sheetOpen": {
    en: "Show wallet and tickets",
    sn: "Wona wallet nematikiti",
  },
  "home.sheetClose": {
    en: "Show more of the map",
    sn: "Wona zvimwe pamap",
  },

  "home.peekArrives": { en: "Arrives", sn: "Inosvika" },
  "home.peekFrom": { en: "from", sn: "kubva" },

  // V1 answer first home: the peek answers a known commuter's moment instead
  // of opening with a search box. Copy stays honest about the wallet and the
  // payment that one tap will make.
  "home.answerUsual": {
    en: "Your usual trip",
    sn: "Rwendo rwako rwemazuva ose",
  },
  "home.answerReturn": {
    en: "Your ride back",
    sn: "Rwendo rwako rwekudzokera",
  },
  "home.answerWalletCovers": {
    en: "Your wallet covers this",
    sn: "Chikwama chako chinokwana",
  },
  "home.answerWalletShort": {
    en: "Wallet short, this books as cash",
    sn: "Chikwama hachikwani, iyi inobhukwa secash",
  },
  "home.answerCta": {
    en: "Rebook this trip",
    sn: "Bhuka rwendo urwu zvakare",
  },
  "home.answerOther": {
    en: "Plan a different trip",
    sn: "Ronga rumwe rwendo",
  },

  "nav.home": { en: "Home", sn: "Home" },
  "nav.rides": { en: "Rides", sn: "Rides" },
  "nav.wallet": { en: "Wallet", sn: "Wallet" },
  "nav.you": { en: "You", sn: "You" },

  "home.yourTrips": { en: "Your trips", sn: "Nzendo dzako" },
  "home.etaDemo": {
    en: "demo estimate",
    sn: "demo estimate",
  },
  "home.etaFromRide": {
    en: "from 1 recorded ride",
    sn: "kubva parwendo 1 rwakarekodhwa",
  },
  "home.etaFromRides": {
    en: "from {count} recorded rides",
    sn: "kubva munzendo {count} dzakarekodhwa",
  },

  "eta.cardAria": {
    en: "Where this number comes from",
    sn: "Kwabva number iyi",
  },
  "eta.cardTitle": {
    en: "Where this number comes from",
    sn: "Where this number comes from",
  },
  "eta.cardMeasured": {
    en: "It is measured from {count} real rides we recorded on this road, phone in hand.",
    sn: "Inoyerwa kubva munzendo {count} chaidzo dzatakarekodha pamugwagwa uyu.",
  },
  "eta.cardModel": {
    en: "A trained model waits behind a promotion rule. It serves only when committed numbers prove it beats this measured average on held out rides.",
    sn: "Modhi yakadzidziswa yakamirira mutemo wekukwidziridzwa. Inoshanda chete kana nhamba dzakachengetwa dzichiratidza kuti inokunda avhareji iyi.",
  },
  "eta.cardImprove": {
    en: "Every new recorded ride sharpens it.",
    sn: "Rwendo rwega rwega rutsva rwakarekodhwa runoinatsa.",
  },
  "eta.cardDemo": {
    en: "This is a demo estimate from the offline twin, not a measurement.",
    sn: "Iyi ifungidziro yekuratidzira kubva kumbeu yekumira, kwete chiyero.",
  },
  "eta.cardDemoWhen": {
    en: "It serves when the arrival engine is unreachable or the trip is off the recorded corridor.",
    sn: "Inoshanda kana injini yekusvika isingawanikwe kana rwendo rusiri munzira yakarekodhwa.",
  },
  "eta.cardClose": { en: "Close", sn: "Vhara" },
  "eta.cardMore": {
    en: "See how Svika knows",
    sn: "Wona kuti Svika inoziva sei",
  },

  "intel.title": {
    en: "How Svika knows your arrival",
    sn: "How Svika knows your arrival",
  },
  "intel.intro": {
    en: "No kombi runs on a timetable. The number on your screen stands on a ladder you can check, rung by rung.",
    sn: "Hapana kombi inofamba netimetable. Nhamba iri pascreen yako yakamira padanho raunogona kuongorora.",
  },
  "intel.rung1H": {
    en: "Measured, serving today",
    sn: "Inoyerwa, irikushanda nhasi",
  },
  "intel.rung1B": {
    en: "The number you see is a plain average over segment times from {count} real rides recorded on this road, phone in hand. Its label on every screen says so.",
    sn: "Nhamba yaunoona iavhareji yenguva dzezvikamu kubva panzendo {count} chaidzo dzakarekodhwa munzira ino. Chiratidzo chayo pascreen yega yega chinozvitaura.",
  },
  "intel.rung2H": { en: "Trained, waiting", sn: "Yadzidziswa, yakamirira" },
  "intel.rung2B": {
    en: "A model that learns how each hour of the day moves is trained on the same rides. It does not serve yet.",
    sn: "Modhi inodzidza mafambiro eawa rega rega yakadzidziswa nenzendo dzimwe chetedzo. Haisati yashanda.",
  },
  "intel.rung3H": { en: "One rule decides", sn: "Mutemo umwe chete unosarudza" },
  "intel.rung3B": {
    en: "The model serves only when there are at least {min} recorded journeys and it beats the average on rides it never saw. The verdict lives in a committed file; nothing else decides.",
    sn: "Modhi inoshanda chete kana pane nzendo {min} kana kupfuura dzakarekodhwa uye ichikunda avhareji panzendo yaisati yamboona. Mutongo unogara mufaira yakachengetwa; hapana chimwe chinosarudza.",
  },
  "intel.tableH": { en: "The committed evidence", sn: "Umbowo hwakachengetwa" },
  "intel.rowJourneys": { en: "Recorded journeys", sn: "Nzendo dzakarekodhwa" },
  "intel.rowSegments": { en: "Segment observations", sn: "Zvakacherechedzwa panzira" },
  "intel.rowBaseline": {
    en: "Baseline error, held out",
    sn: "Baseline error",
  },
  "intel.rowModel": { en: "Model error, held out", sn: "Model error" },
  "intel.rowServed": { en: "Serving now", sn: "Irikushanda parizvino" },
  "intel.verdictPromoted": {
    en: "The model beat the baseline on held out rides, so it serves.",
    sn: "Modhi yakakunda avhareji panzendo dzayaisati yaona, saka iri kushanda.",
  },
  "intel.verdictHeld": {
    en: "Verdict: not enough rides to trust any evaluation (the rule asks for {min}), so the plain average serves and every estimate says how many rides it stands on.",
    sn: "Mutongo: nzendo hadzisati dzakwana kuvimba nechiyero (mutemo unoda {min}), saka avhareji ndiyo inoshanda uye fungidziro yega yega inotaura nzendo dzainomira padziri.",
  },
  "intel.note": {
    en: "This table is the training run's own committed file, not retyped numbers. It updates when new rides are recorded.",
    sn: "Tafura iyi ifaira rakachengetwa rekudzidziswa pachako, kwete nhamba dzakanyorwazve. Inovandudzwa kana nzendo itsva dzarekodhwa.",
  },

  "plan.saveTitle": {
    en: "Save this trip for your home map",
    sn: "Save this trip for your home map",
  },
  "plan.savePlaceholder": {
    en: "e.g. Work trip",
    sn: "sekuti Rwendo rwekubasa",
  },
  "plan.saveCta": { en: "Save", sn: "Save" },
  "plan.savedNote": {
    en: "Saved. It now lives on your home map.",
    sn: "Yasaviwa. Yave kuoneka pamap yako.",
  },
  "plan.saveErr": {
    en: "That name did not save. Try a shorter one.",
    sn: "Zita iri harina ku saviwa. Edza zita pfupi.",
  },

  "theme.toDark": {
    en: "Switch to night mode",
    sn: "Chinja kuenda ku night mode",
  },
  "theme.toLight": {
    en: "Switch to day mode",
    sn: "Chinja kuenda ku day mode",
  },

  "map.ariaLabel": {
    en: "Map of the Heights to Rezende corridor with kombis moving along the road. Vehicle movement is a demo, not live tracking.",
    sn: "Mepu yenzira yeHeights kusvika Rezende ine makombi ari kufamba mumugwagwa. Kufamba kwemakombi ndekwekuratidzira, hakusi live.",
  },
  "map.demoChip": { en: "Demo movement", sn: "Movement yedemo" },
  "map.viewWhole": { en: "Whole route", sn: "Route yese" },
  "map.viewNear": { en: "Boarding area", sn: "Paukukwirira" },
  "map.view3d": { en: "3D buildings", sn: "Zvivako 3D" },
  "map.viewFlat": { en: "Flat map", sn: "Mepu yakati sandara" },
  "map.unavailable": {
    en: "The map could not load. Your trips and wallet still work.",
    sn: "Map yatadza kuvhurika. Nzendo dzako newallet zvichiri kushanda.",
  },

  // consent and privacy. Shona here is machine drafted and waits for the
  // external translator pass, like every other Shona string in this file.
  "consent.title": { en: "Before you ride", sn: "Before you ride" },
  "consent.intro": {
    en: "Svika keeps a record of your trips, tickets and wallet credit so your change never gets lost. Here is what that means.",
    sn: "Svika inochengeta nzendo dzako, matikiti nemari yechikwama kuti chenji yako irege kurasika. Hezvino zvazvinoreva.",
  },
  "consent.point1": {
    en: "Your name, phone number and language choice are stored with your account.",
    sn: "Zita rako, nhamba yefoni nemutauro waunosarudza zvinochengetwa neakaunti yako.",
  },
  "consent.point2": {
    en: "Every ticket and wallet movement is kept. Money history is never edited or deleted.",
    sn: "Tikiti rimwe nerimwe nekufamba kwemari zvinochengetwa. Nhoroondo yemari haigadziridzwe kana kudzimwa.",
  },
  "consent.point3": {
    en: "Trip patterns improve arrival predictions. Owners see route totals, never your name.",
    sn: "Mafambiro enzendo anovandudza fungidziro dzekusvika. Varidzi vanoona huwandu hwenzira, kwete zita rako.",
  },
  "consent.point4": {
    en: "You can see everything Svika holds about you and delete your details at any time.",
    sn: "Unogona kuona zvese zvakachengetwa neSvika nezvako uye kudzima ruzivo rwako chero nguva.",
  },
  "consent.noticeLink": {
    en: "Read the full privacy notice",
    sn: "Verenga chiziviso chekuvanzika chizere",
  },
  "consent.accept": { en: "I understand and agree", sn: "Ndanzwisisa uye ndinobvuma" },
  "consent.declineHint": {
    en: "If you do not agree, sign out. Nothing beyond your sign in is stored.",
    sn: "Kana usingabvume, buda. Hapana chinochengetwa kunze kwekupinda kwako.",
  },
  "consent.err": {
    en: "That did not save. Try again.",
    sn: "Hazvina kuchengetedzwa. Edzazve.",
  },

  "privacy.title": {
    en: "How Svika treats your data",
    sn: "How Svika treats your data",
  },
  "privacy.collectH": { en: "What Svika stores", sn: "Zvinochengetwa neSvika" },
  "privacy.collectB": {
    en: "Your name, phone number, language, tickets, wallet credit and the trips you save. Nothing else.",
    sn: "Zita rako, nhamba yefoni, mutauro, matikiti, mari yechikwama nenzendo dzaunochengeta. Hapana zvimwe.",
  },
  "privacy.whyH": { en: "Why", sn: "Sei" },
  "privacy.whyB": {
    en: "Tickets and credit are money, so they need a full record. Trip patterns make arrival predictions better for everyone.",
    sn: "Matikiti nemari zvinoda nhoroondo izere. Mafambiro enzendo anonatsiridza fungidziro dzekusvika kune wese.",
  },
  "privacy.moneyH": { en: "The money rule", sn: "Mutemo wemari" },
  "privacy.moneyB": {
    en: "The wallet is an append only ledger. Entries are added, never edited, never deleted. That is how your change stays safe.",
    sn: "Chikwama ibhuku remari rinongowedzerwa. Zvinyorwa zvinowedzerwa, hazvigadziridzwe, hazvidzimwe. Ndiko kuchengetedzwa kwechenji yako.",
  },
  "privacy.aiH": { en: "What the AI sees", sn: "Zvinoonekwa ne AI" },
  "privacy.aiB": {
    en: "Predictions and leakage checks run on our servers over patterns and totals. They never name a person and nothing runs on your phone.",
    sn: "Fungidziro nekuongorora mari zvinoshanda pamaseva edu zvichishandisa mafambiro nehuwandu. Hazvidome munhu uye hapana chinoshanda pafoni yako.",
  },
  "privacy.shareH": { en: "Who sees your data", sn: "Ndiani anoona data rako" },
  "privacy.shareB": {
    en: "Nobody outside Svika. No selling, no adverts. Owners see route totals, conductors see board codes, neither sees who you are.",
    sn: "Hapana ari kunze kweSvika. Hakuna kutengeswa, hakuna zvishambadzo. Varidzi vanoona huwandu hwenzira, mahwindi anoona makodhi, hapana anoona kuti ndiwe ani.",
  },
  "privacy.controlH": { en: "Your controls", sn: "Masimba ako" },
  "privacy.controlB": {
    en: "The your data page shows everything held about you. Deleting removes your name, phone and saved trips; ticket and money history stays but no longer says who you are.",
    sn: "Peji reruzivo rwako rinoratidza zvese zvakachengetwa nezvako. Kudzima kunobvisa zita, foni nenzendo dzakachengetwa; nhoroondo yematikiti nemari inosara asi haichataure kuti ndiwe ani.",
  },
  "privacy.versionLabel": { en: "Notice version", sn: "Notice version" },
  "privacy.yourDataLink": {
    en: "Your data and privacy",
    sn: "Data rako neprivacy",
  },

  // The disclosure register: what is real and what is staged, on screen for a
  // judge to open. The feature rows themselves are the English canonical
  // register (docs/DISCLOSURE-REGISTER.md); the Shona chrome owes the human
  // translator pass like the rest of the app.
  "register.title": {
    en: "What is real, what is staged",
    sn: "Zvechokwadi, nezvakagadzirirwa",
  },
  "register.intro": {
    en: "Every feature in this demo, and exactly what is happening behind it. We never present a staged surface as live.",
    sn: "Chimiro chega chega mudemo ino, nezviri kuitika seri kwacho. Hatimboratidzi chinhu chakagadzirirwa sechiri kushanda.",
  },
  "register.tier1": { en: "Real and live", sn: "Chechokwadi, chiri kushanda" },
  "register.tier1Note": {
    en: "Working against the live database.",
    sn: "Chiri kushanda pane database chaiyo.",
  },
  "register.tier2": {
    en: "Staged, always labelled",
    sn: "Chakagadzirirwa, chinogara chakanyorwa",
  },
  "register.tier2Note": {
    en: "Clickable with a fixed or simulated backend, labelled on screen.",
    sn: "Chinodzvanywa asi chine backend yakagadzirirwa, chakanyorwa pachikamu.",
  },
  "register.updated": { en: "Last updated", sn: "Yagadziridzwa" },
  "register.link": {
    en: "What is real, what is staged",
    sn: "Zvechokwadi, nezvakagadzirirwa",
  },
  "repo.link": { en: "View the code", sn: "Ona kodhi" },

  "lang.english": { en: "English", sn: "Chirungu" },
  "lang.shona": { en: "Shona", sn: "Shona" },
  "lang.ndebele": { en: "Ndebele", sn: "Ndebele" },
  "lang.comingSoon": { en: "coming soon", sn: "zvichauya" },

  "yourdata.title": {
    en: "What Svika knows about you",
    sn: "What Svika knows about you",
  },
  "yourdata.profileH": { en: "Your profile", sn: "Profile yako" },
  "yourdata.name": { en: "Name", sn: "Zita" },
  "yourdata.language": { en: "Language", sn: "Mutauro" },
  "yourdata.none": { en: "Not set", sn: "Haisi setiwa" },
  "yourdata.countsH": { en: "Your history", sn: "History yako" },
  "yourdata.tickets": { en: "Tickets", sn: "Matikiti" },
  "yourdata.movements": { en: "Wallet movements", sn: "Kufamba kwemari muWallet" },
  "yourdata.savedTrips": { en: "Saved trips", sn: "Nzendo dzakasaviwa" },
  "yourdata.consents": { en: "Consent records", sn: "Marecords ekubvumira" },
  "yourdata.deleteH": { en: "Delete your details", sn: "Dzima details ako" },
  "yourdata.deleteB": {
    en: "Money and ticket history is append only, so it cannot be erased. Deleting removes your name and phone, deletes your saved trips, and closes the app until you agree again. Your sign in stays until an operator removes it.",
    sn: "Nhoroondo yemari nematikiti inongowedzerwa, saka haigone kudzimwa. Kudzima kunobvisa zita nefoni yako, kunodzima nzendo dzakachengetwa, uye kunovhara app kusvika wabvumazve. Kupinda kwako kunosara kusvika mushandi akubvisa.",
  },
  "yourdata.deleteCta": { en: "Delete my details", sn: "Dzima details angu" },
  "yourdata.deleteConfirm": {
    en: "Yes, delete my details",
    sn: "Ehe, dzima details angu",
  },
  "yourdata.deleteCancel": { en: "Keep them", sn: "Asiye" },
  "yourdata.err": {
    en: "That did not work. Try again.",
    sn: "Izvi hazvina kushanda. Edza zvakare.",
  },
  "profile.open": { en: "Profile and settings", sn: "Profile uye settings" },
  "profile.title": { en: "Your Svika", sn: "Your Svika" },

  // welcome header (unreferenced screen, spec gap proposal): greeting in Harare
  // time, the rider's name, and honest ride stats.
  "profile.greetMorning": { en: "Good morning", sn: "Mangwanani" },
  "profile.greetAfternoon": { en: "Good afternoon", sn: "Masikati" },
  "profile.greetEvening": { en: "Good evening", sn: "Manheru" },
  "profile.welcomeNoName": { en: "Welcome to Svika", sn: "Mawuya paSvika" },
  "profile.statTotal": { en: "Total rides", sn: "Nzendo dzese" },
  "profile.statMonth": { en: "This month", sn: "Mwedzi uno" },
  "profile.statFave": { en: "Top trip", sn: "Rwendo rwepamusoro" },
  "profile.statsEmpty": {
    en: "No rides yet. Plan a trip and your count starts here.",
    sn: "Hapana nzendo parizvino. Ronga rwendo kuti dzitange kuverengwa.",
  },
  "profile.statsDemo": {
    en: "Some of these rides are simulated demo history.",
    sn: "Dzimwe nzendo idzi ndedze demo.",
  },
  "profile.settingsH": { en: "Settings", sn: "Settings" },
  "profile.appearanceH": { en: "Look and language", sn: "Ratidziro nemutauro" },
  "profile.languageH": { en: "Language", sn: "Mutauro" },
  "profile.themeH": { en: "Day or night", sn: "Masikati kana husiku" },

  "profile.youH": { en: "Your details", sn: "Details ako" },
  "profile.nameLabel": { en: "Your name", sn: "Zita rako" },
  "profile.phoneLabel": { en: "Phone", sn: "Foni" },
  "profile.saveCta": { en: "Save", sn: "Save" },
  "profile.savedNote": { en: "Saved.", sn: "Yasaviwa." },
  "profile.tripsH": { en: "Saved trips", sn: "Nzendo dzakasaviwa" },
  "profile.tripsNone": {
    en: "No saved trips yet. Plan a trip and give it a name.",
    sn: "Hapana nzendo dzakasaviwa. Ronga rwendo urupe zita.",
  },
  "profile.renameCta": { en: "Rename", sn: "Chinja zita" },
  "profile.removeCta": { en: "Remove", sn: "Bvisa" },
  "profile.historyH": { en: "Your rides", sn: "Nzendo dzako" },
  "profile.historySummary": {
    en: "{count} rides with Svika since {month}.",
    sn: "Nzendo {count} neSvika kubva {month}.",
  },
  "profile.historyFirst": {
    en: "Your first ride with Svika.",
    sn: "Rwendo rwako rwekutanga neSvika.",
  },
  "profile.historyNone": {
    en: "Your rides will appear here after your first trip.",
    sn: "Nzendo dzako dzichaoneka pano mushure merwendo rwako rwekutanga.",
  },
  "profile.alertsH": { en: "Commute alerts", sn: "Ma alerts erwendo rwako" },
  "profile.alertsB": {
    en: "When your usual kombi is getting close in your usual travel window, Svika tells you. Built only from your own ride history.",
    sn: "Kana kombi yaunogara uchikwira yaswedera panguva yaunowanzofamba, Svika inokuudza. Zvinobva munhoroondo yenzendo dzako chete.",
  },
  "profile.voiceH": { en: "Voice guide", sn: "Voice guide" },
  "profile.voiceB": {
    en: "A voice that tells you when your stop is near and when to get off. Turn it on per language.",
    sn: "Inzwi rinokuudza kana chiteshi chako chaswedera uye pekuburuka. Batidza pamutauro waunoda.",
  },
  "profile.voiceNote": {
    en: "The current voice is a placeholder until recorded Zimbabwean voices land.",
    sn: "Inzwi ririko nderekumbomira kusvika manzwi echiZimbabwe akarekodhwa asvika.",
  },
  "profile.voiceEn": { en: "English voice", sn: "Izwi rechirungu" },
  "profile.voiceSn": { en: "Shona voice", sn: "Izwi reShona" },
  "profile.on": { en: "On", sn: "Batidza" },
  "profile.off": { en: "Off", sn: "Dzima" },
  "profile.emergencyH": { en: "Emergency details", sn: "Details epa emergency" },
  "profile.emergencyWhy": {
    en: "If something happens on the road, the person you name here is who gets called, and your medical aid details speed up help. Svika asks so that help is one tap away, never for marketing. This is optional, only you can see it, and you can remove it any time.",
    sn: "Kana chimwe chikaitika murwendo, munhu waunonyora pano ndiye anofonerwa, uye ruzivo rwemedical aid rwako runokurumidzisa rubatsiro. Svika inokumbira kuti rubatsiro rive pedyo, kwete zvekushambadza. Izvi ndezvekuzvisarudzira, ndiwe wega unozviona, uye unogona kuzvibvisa chero nguva.",
  },
  "profile.kinName": { en: "Next of kin name", sn: "Zita rehama yako wepedyo" },
  "profile.kinPhone": { en: "Next of kin phone", sn: "Foni yehama yako wepedyo" },
  "profile.aidName": { en: "Medical aid name", sn: "Zita re medical aid" },
  "profile.aidNumber": { en: "Medical aid number", sn: "Number ye medical aid" },
  "profile.emergencyConsent": {
    en: "I agree that Svika stores these details for emergencies. I can remove them at any time.",
    sn: "Ndinobvuma kuti Svika ichengete ruzivo urwu rwepakaoma. Ndinogona kuzvibvisa chero nguva.",
  },
  "profile.emergencySave": {
    en: "Save emergency details",
    sn: "Sava details epa emergency",
  },
  "profile.emergencyRemove": { en: "Remove these details", sn: "Bvisa details aya" },
  "profile.emergencySaved": {
    en: "Saved. Only you can see these details.",
    sn: "Yasaviwa. Ndiwe chete unoona details aya.",
  },
  "profile.emergencyRemoved": {
    en: "Removed, and the withdrawal is recorded.",
    sn: "Yabviswa.",
  },
  "profile.errConsent": {
    en: "Tick the consent box first.",
    sn: "Tika pa box rekubvumira kutanga.",
  },
  "profile.errEmpty": {
    en: "Add at least one detail before saving.",
    sn: "Isa at least detail imwe usati wasava.",
  },
  "profile.errGeneric": {
    en: "That did not save. Try again.",
    sn: "Hazvina kuchengetedzwa. Edzazve.",
  },
  "voice.approaching": {
    en: "Your stop is coming up.",
    sn: "Stop chako chave pedyo.",
  },
  "voice.getOff": {
    en: "This is your stop. Get off here.",
    sn: "Ichi ndicho stop chako. Buruka pano.",
  },
  "voice.walk": {
    en: "Your walking leg starts here.",
    sn: "Kufamba netsoka kwako kunotangira pano.",
  },

  "alert.title": {
    en: "Your usual kombi is close",
    sn: "Your usual kombi is close",
  },

  "share.sectionH": { en: "Share my ride", sn: "Shera rwendo rwangu" },
  "share.sectionB": {
    en: "Send this link to someone who worries about you. They follow the trip on a map, never your code or your money.",
    sn: "Tumira link iyi kune anokufungira. Vanoona rwendo pamepu, kwete kodhi yako kana mari yako.",
  },
  "share.createCta": { en: "Create the link", sn: "Gadzira link" },
  "share.linkLabel": {
    en: "Anyone with this link can follow the trip",
    sn: "Chero ane link iyi anogona kuona rwendo urwu",
  },
  "share.revokeCta": { en: "Stop sharing", sn: "Misa kushera" },
  "share.revokedNote": {
    en: "Sharing stopped. The link is dead now.",
    sn: "Kushera kwamira. Link yafa manje.",
  },
  "share.err": {
    en: "That did not work. Try again.",
    sn: "Izvi hazvina kushanda. Edza zvakare.",
  },
  "share.expiryNote": {
    en: "The link stops working when the trip ends.",
    sn: "Link inorega kushanda kana rwendo rwapera.",
  },
  "share.viewerTitle": { en: "Following a trip", sn: "Following a trip" },
  "share.statusWaiting": { en: "Waiting to board", sn: "Kumirira kukwira" },
  "share.statusOnBoard": { en: "On board", sn: "Vari mukombi" },
  "share.arrives": { en: "Arrives", sn: "Inosvika" },
  "share.canSeeH": { en: "What you can see", sn: "Zvaunokwanisa kuona" },
  "share.canSee1": {
    en: "The route this trip rides and where the kombis on it are right now.",
    sn: "Nzira yerwendo urwu uye pari makombi ayo izvozvi.",
  },
  "share.canSee2": {
    en: "The stop the trip ends at and the arrival estimate.",
    sn: "Chiteshi chinopera rwendo nefungidziro yekusvika.",
  },
  "share.cannotSeeH": { en: "What you cannot see", sn: "Zvausingakwanise kuona" },
  "share.cannotSee1": {
    en: "Who is riding, their phone number, their boarding code or their wallet.",
    sn: "Ari kufamba, nhamba yefoni yake, kodhi yake kana chikwama chake.",
  },
  "share.deadH": { en: "This link is no longer live", sn: "Link iyi haichashandi" },
  "share.deadB": {
    en: "The trip has ended or the rider stopped sharing it.",
    sn: "Rwendo rwapera kana kuti mufambi amisa kushera.",
  },

  // --- the intelligence doors: the three spines with their evidence -------

  // --- vision scenes: simulations of what ships next, always stamped ------

  // Tinashe's crash flow

  // Gogo on her mbudzi
  // Kombi capacity
} as const satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

export function t(lang: AppLanguage, key: DictKey): string {
  return dict[key][lang];
}
