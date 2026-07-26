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
  // V2 ruling 6 (2026-07-26): value before the wall. The primary door is
  // the live map with no account; signing in is the second line.
  "landing.cta": { en: "Open the live map", sn: "Vhura mepu live" },
  "landing.guestNote": {
    en: "No account needed to look around.",
    sn: "Haudi account kuti utarise.",
  },
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

  // kombi card and board (batch K1). Trust copy is rules and counts about a
  // vehicle's fare ledger, never about a person. Shona is machine drafted
  // pending the external translator pass, like the rest of this file.
  "kombi.markerTap": { en: "Kombi details", sn: "Ruzivo rwekombi" },
  "kombi.towards": { en: "Heading to {name}", sn: "Iri kuenda ku{name}" },
  "kombi.arrives": { en: "At {stop} in", sn: "Pa{stop} mu" },
  "kombi.away": {
    en: "Not on the way to your stop this run.",
    sn: "Haisi kuuya kuchiteshi chako parwendo urwu.",
  },
  "kombi.seats": { en: "Declared seats", sn: "Zvigaro zvakanyorwa" },
  "kombi.seatsUnknown": { en: "Not declared yet", sn: "Hazvisati zvanyorwa" },
  "kombi.plateUnknown": { en: "Not linked yet", sn: "Haisati yabatanidzwa" },
  "kombi.trustTitle": { en: "Trust record", sn: "Rekodhi yekuvimbika" },
  "kombi.trustUnverified": { en: "Unverified", sn: "Hakusati kwasimbiswa" },
  "kombi.trustVerified": { en: "Verified fares", sn: "Mari dzakasimbiswa" },
  "kombi.trustDrift": { en: "Seats drift", sn: "Musiyano wezvigaro" },
  "kombi.trustNone": {
    en: "No verified fares on this kombi yet. The record builds as conductors clear fares here.",
    sn: "Hapasati pane mari dzakasimbiswa pakombi iyi. Rekodhi inovakwa apo makondakita anobhadharisa pano.",
  },
  "kombi.trustFares": {
    en: "{count} verified fares across {days} days in the last 30.",
    sn: "Mari {count} dzakasimbiswa pamazuva {days} mumazuva makumi matatu apfuura.",
  },
  "kombi.trustDriftLine": {
    en: "On {days} days the busiest hour cleared more fares than the declared seats.",
    sn: "Pamazuva {days} awa rakabatikana rakapfuura zvigaro zvakanyorwa.",
  },
  "kombi.trustLaw": {
    en: "This record describes a vehicle's fare ledger, never a person.",
    sn: "Rekodhi iyi inotaura nezvemari yekombi, kwete munhu.",
  },
  "kombi.provenance": {
    en: "Position is demo movement. Plate, seats and counts come from the registry and the fare ledger.",
    sn: "Nzvimbo ndeyekuratidzira. Nhamba, zvigaro nehuwandu zvinobva muregistry nemubhuku remari.",
  },
  "kombi.boardCta": { en: "All kombis", sn: "Makombi ese" },
  "kombi.boardTitle": { en: "Kombis on the road", sn: "Makombi ari munzira" },
  "kombi.boardChip": { en: "Kombis", sn: "Makombi" },
  "kombi.boardBack": { en: "Back to the map", sn: "Dzokera kumepu" },

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
  // V3 ruling 4 (2026-07-26): relationship neutral everywhere. The contact
  // is "your guardian contact" / someone you trust, never assumed a relative.
  "profile.kinName": {
    en: "Guardian contact name",
    sn: "Zita remunhu wako wepedyo",
  },
  "profile.kinPhone": {
    en: "Guardian contact phone",
    sn: "Foni yemunhu wako wepedyo",
  },
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

  // --- journey recording (M1): record my trip. Shona here is machine
  // drafted and rides the standing external translator pass. -----------------
  "journey.recordTitle": { en: "Record my trip", sn: "Rekodha rwendo rwangu" },
  "journey.start": { en: "Start recording", sn: "Tanga kurekodha" },
  "journey.rec": { en: "Recording", sn: "Kurekodha" },
  "journey.stop": { en: "Stop recording", sn: "Misa kurekodha" },
  "journey.deniedH": {
    en: "Svika cannot see your location",
    sn: "Svika haikwanise kuona pauri",
  },
  "journey.deniedB": {
    en: "Location permission is off for this site. Allow location in your browser settings, then try again.",
    sn: "Mvumo yenzvimbo yakavharwa. Vhura mvumo yenzvimbo mubrowser yako, wozama zvakare.",
  },
  "journey.insecureB": {
    en: "Location only works on a secure connection (https). Open Svika over https and try again.",
    sn: "Nzvimbo inoshanda chete pahttps. Vhura Svika nehttps wozama zvakare.",
  },
  "journey.unsupportedB": {
    en: "This browser does not offer location.",
    sn: "Browser iyi haina nzvimbo.",
  },
  "journey.retry": { en: "Try again", sn: "Zama zvakare" },
  "journey.finishTitle": { en: "Your trip", sn: "Rwendo rwako" },
  "journey.distance": { en: "Distance", sn: "Daro" },
  "journey.duration": { en: "Time", sn: "Nguva" },
  "journey.points": { en: "GPS points", sn: "Mapoinzi eGPS" },
  "journey.nameLabel": { en: "Name this trip", sn: "Tumidza rwendo urwu" },
  "journey.namePh": { en: "Home to the shops", sn: "Kumba kuenda kuzvitoro" },
  "journey.save": { en: "Save trip", sn: "Chengeta rwendo" },
  "journey.discard": { en: "Discard this trip", sn: "Rasa rwendo urwu" },
  "journey.consentH": {
    en: "Save your trips to your account?",
    sn: "Chengeta nzendo dzako muakaundi yako?",
  },
  "journey.consentB": {
    en: "Saving uploads this trace to your Svika account so you can see and share it from any phone. Only you can see your trips. You can withdraw this and delete them any time on the privacy page.",
    sn: "Kuchengeta kunoendesa rwendo urwu kuakaundi yako yeSvika kuti uone nekugovera kubva pafoni ipi zvayo. Iwe chete unoona nzendo dzako. Unogona kubvisa mvumo nekudzima nzendo papeji yeprivacy chero nguva.",
  },
  "journey.consentAgree": {
    en: "I agree, save my trips",
    sn: "Ndinobvuma, chengeta nzendo dzangu",
  },
  "journey.consentLocal": {
    en: "Keep on this phone only",
    sn: "Chengeta pafoni ino chete",
  },
  "journey.localNote": {
    en: "This trip stays on this phone. Nothing was uploaded.",
    sn: "Rwendo urwu runogara pafoni ino. Hapana chakaendeswa.",
  },
  "journey.listTitle": { en: "My trips", sn: "Nzendo dzangu" },
  "journey.listEmpty": {
    en: "No recorded trips yet. Start one from the plan screen or your ticket.",
    sn: "Hapasati pane nzendo dzakarekodhwa. Tanga imwe papeji yekuronga kana patikiti rako.",
  },
  "journey.localChip": { en: "On this device", sn: "Pafoni ino" },
  "journey.conflictChip": { en: "Sync conflict", sn: "Sync haina kuwirirana" },
  "journey.record": { en: "Record this trip", sn: "Rekodha rwendo urwu" },
  "journey.saved": { en: "Trip saved", sn: "Rwendo rwachengetwa" },
  "journey.detailFallback": { en: "Recorded trip", sn: "Rwendo rwakarekodhwa" },
  "journey.modeLabel": { en: "Mode", sn: "Mhando" },
  "journey.mode.walk": { en: "Walking", sn: "Kufamba" },
  "journey.mode.kombi": { en: "Kombi", sn: "Kombi" },
  "journey.mode.mixed": { en: "Mixed", sn: "Zvakasanganiswa" },

  // --- journey guide links (M2): share a trip to a friend. Shona is
  // machine drafted, rides the standing external translator pass. ----------
  "journey.shareH": { en: "Guide a friend", sn: "Tungamira shamwari" },
  "journey.shareB": {
    en: "Share this trip as a guide link. Whoever holds the link sees the path and their own position on it, no account needed, for seven days. Nothing says who recorded it.",
    sn: "Govera rwendo urwu selink yenhungamiro. Ane link anoona nzira nepaanenge ari pairi, pasina akaundi, kwemazuva manomwe. Hapana chinotaura kuti ndiani akarekodha.",
  },
  "journey.shareCta": { en: "Create guide link", sn: "Gadzira link yenhungamiro" },
  "journey.shareRevoke": { en: "Stop sharing", sn: "Misa kugovera" },
  "journey.shareRevoked": { en: "The link is dead now.", sn: "Link yafa zvino." },
  // --- places layer (M3): name the city. Personal first, promote by
  // consensus; copy flags names, never people. Shona is machine drafted,
  // rides the standing external translator pass. ----------------------------
  "places.title": { en: "Name the city", sn: "Tumidza guta" },
  "places.doorB": {
    en: "Name stops, gates and shortcuts on your own map",
    sn: "Tumidza zviteshi, magedhi nenzira dzekudimbudzira pamepu yako",
  },
  "places.intro": {
    en: "Riders name the city the way Harare actually talks. What you save is yours alone until other riders agree.",
    sn: "Vafambi vanotumidza guta sematauriro anoita Harare chaiwo. Zvaunochengeta ndezvako wega kusvika vamwe vafambi vabvumirana.",
  },
  "places.pinHint": {
    en: "Tap the map to move the pin",
    sn: "Baya pamepu kufambisa chibaiso",
  },
  "places.recommendH": {
    en: "Names people use here",
    sn: "Mazita anoshandiswa nevanhu pano",
  },
  "places.nameLabel": {
    en: "What do people call this spot?",
    sn: "Nzvimbo ino inonzi chii nevanhu?",
  },
  "places.kindLabel": { en: "What is it?", sn: "Chii ichi?" },
  "places.kind.stop": { en: "Stop", sn: "Chiteshi" },
  "places.kind.place": { en: "Place", sn: "Nzvimbo" },
  "places.kind.gate": { en: "Gate", sn: "Gedhi" },
  "places.kind.landmark": { en: "Landmark", sn: "Chiratidzo" },
  "places.saveCta": { en: "Save this name", sn: "Chengeta zita iri" },
  "places.outcome.success": {
    en: "Saved to your map. A name goes public only when the community agrees.",
    sn: "Zvachengetwa pamepu yako. Zita rinobuda pachena chete kana nharaunda yabvumirana.",
  },
  "places.outcome.blocked_word": {
    en: "That name cannot be saved. Use the name people actually call this place.",
    sn: "Zita iro harigoni kuchengetwa. Shandisa zita rinodaidzwa nevanhu chaizvo.",
  },
  "places.outcome.rate_limited": {
    en: "You have named a lot today. Try again tomorrow.",
    sn: "Watumidza zvakawanda nhasi. Edza zvakare mangwana.",
  },
  "places.outcome.invalid": {
    en: "That name cannot be saved. Two to sixty letters.",
    sn: "Zita iro harigoni kuchengetwa. Mavara maviri kusvika makumi matanhatu.",
  },
  "places.guestCta": { en: "Sign in to name places", sn: "Pinda kuti utumidze nzvimbo" },
  "places.nearbyH": { en: "Named nearby", sn: "Zvakatumidzwa pedyo" },
  "places.scope.personal": { en: "Only you see this", sn: "Ndiwe wega unozviona" },
  "places.scope.suggested": {
    en: "Suggested by riders",
    sn: "Zvakakarakadzwa nevafambi",
  },
  "places.scope.public": { en: "Public name", sn: "Zita repachena" },
  "places.report": { en: "Report this name", sn: "Mhan'ara zita iri" },
  "places.reported": {
    en: "Reported. Three independent reports hide a name.",
    sn: "Zvamhan'arwa. Mhan'aro nhatu dzakazvimirira dzinovanza zita.",
  },
  "journey.shortcutH": { en: "Shortcut", sn: "Nzira yekudimbudzira" },
  "journey.shortcutB": {
    en: "Flag this walk as a shortcut and it draws on your places map. If other riders walk the same cut through, it can become public.",
    sn: "Ratidza kufamba uku senzira yekudimbudzira igotarwa pamepu yako yenzvimbo. Kana vamwe vafambi vachifamba nenzira imwe chete, inogona kubuda pachena.",
  },
  "journey.shortcutCta": {
    en: "Flag as a shortcut",
    sn: "Ratidza senzira yekudimbudzira",
  },
  "journey.shortcutDone": {
    en: "Flagged. It draws on your places map.",
    sn: "Zvaratidzwa. Inotarwa pamepu yako yenzvimbo.",
  },
  "journey.shortcutInvalid": {
    en: "This trip cannot be a shortcut. A shortcut is a walk between 30 m and 5 km.",
    sn: "Rwendo urwu harugoni kuva nzira yekudimbudzira. Inofanira kuva kufamba kuri pakati pe 30 m ne 5 km.",
  },
  "journey.shortcutRate": {
    en: "You have flagged a lot today. Try again tomorrow.",
    sn: "Waratidza zvakawanda nhasi. Edza zvakare mangwana.",
  },

  // --- post trip feedback (D2): did we get you there right? Three taps,
  // skippable, tunes plans and never people. Shona is machine drafted,
  // rides the standing external translator pass. -----------------------------
  "feedback.title": {
    en: "Did we get you there right?",
    sn: "Takusvitsa zvakanaka here?",
  },
  "feedback.qKombi": { en: "Right kombi?", sn: "Kombi yacho here?" },
  "feedback.qStop": { en: "Right stop?", sn: "Chiteshi chacho here?" },
  "feedback.qWalk": {
    en: "Too much walking?",
    sn: "Kwakanyanya kufamba here?",
  },
  "feedback.yes": { en: "Yes", sn: "Hongu" },
  "feedback.no": { en: "No", sn: "Kwete" },
  "feedback.skip": { en: "Skip", sn: "Siya" },
  "feedback.thanks": {
    en: "Thank you. This tunes the planner for everyone.",
    sn: "Tatenda. Izvi zvinovandudza kuronga kwedu kune vose.",
  },
  "feedback.note": {
    en: "Answers tune plans, never people.",
    sn: "Mhinduro dzinovandudza kuronga, kwete vanhu.",
  },

  "guide.title": { en: "Trip guide", sn: "Nhungamiro yerwendo" },
  "guide.sharedTrip": { en: "A shared trip", sn: "Rwendo rwakagoverwa" },
  "guide.intro": {
    en: "A path recorded by a friend. Follow the line; the dot is you.",
    sn: "Nzira yakarekodhwa neshamwari. Tevera mutsara; dhoti ndiwe.",
  },
  "guide.locate": { en: "Show me on the path", sn: "Ndiratidze panzira" },
  "guide.denied": {
    en: "Svika cannot see your location. The path still shows; allow location to see yourself on it.",
    sn: "Svika haikwanise kuona pauri. Nzira inoramba ichionekwa; bvumira nzvimbo kuti uzvione pairi.",
  },
  "guide.stepsH": { en: "The way", sn: "Nzira" },
  "guide.step.startWalk": {
    en: "Walk {m} m along the path",
    sn: "Famba {m} m uchitevera nzira",
  },
  "guide.step.startRide": { en: "Ride {m} m", sn: "Kwira kombi {m} m" },
  "guide.step.left": {
    en: "Turn left and continue {m} m",
    sn: "Kotamira kuruboshwe wofamba {m} m",
  },
  "guide.step.right": {
    en: "Turn right and continue {m} m",
    sn: "Kotamira kurudyi wofamba {m} m",
  },
  "guide.step.walk": { en: "Then walk {m} m", sn: "Wozofamba {m} m" },
  "guide.step.ride": { en: "Then ride {m} m", sn: "Wozokwira kombi {m} m" },
  "guide.cue.off-path": {
    en: "You have left the path. Head back toward the line.",
    sn: "Wabuda munzira. Dzokera kumutsara.",
  },
  "guide.cue.approaching": { en: "Nearly there", sn: "Wakusvika" },
  "guide.cue.arrived": { en: "You have arrived", sn: "Wasvika" },
  "guide.notAi": {
    en: "These directions are the recorded path itself, replayed. Steps come from plain geometry. No routing engine, no AI.",
    sn: "Nhungamiro idzi inzira yakarekodhwa pachayo. Nhanho dzinobva pageometry chaiyo. Hapana routing engine, hapana AI.",
  },

  // --- guardian mode (batch V3): family links and safe arrival ------------
  // Copy law: every state flags a situation, never a person.
  "ticket.status.arrived": { en: "Arrived safely", sn: "Wasvika zvakanaka" },
  "ticket.arrivedCta": { en: "I have arrived safely", sn: "Ndasvika zvakanaka" },
  "ticket.arrivedNote": {
    en: "Anyone following your shared trip sees you arrived.",
    sn: "Munhu wese ari kutevera rwendo rwako anoona kuti wasvika.",
  },
  "ticket.guardianH": { en: "Travel with me", sn: "Famba neni" },
  "ticket.guardianB": {
    en: "Let {name} follow this trip live and see you arrive. One tap makes the link; send it with any app.",
    sn: "Rega {name} atevere rwendo urwu achiona kusvika kwako. Dzvanya kamwe kugadzira link; itumire neapp chero ipi.",
  },
  "ticket.guardianCta": { en: "Share with {name}", sn: "Shera na{name}" },
  "ticket.guardianNone": {
    en: "Add a guardian contact on your profile and every trip can reach them in one tap.",
    sn: "Isa munhu wako wepedyo paprofile yako uye rwendo rwese runosvika kwaari nekudzvanya kamwe.",
  },
  // V3 ruling 3: the guidance prompted arrival confirm; it only ever asks
  "voice.arrivedPrompt": {
    en: "Arrived safely? One tap lets anyone following your trip know.",
    sn: "Wasvika zvakanaka here? Dzvanya kamwe kuti vanotevera rwendo rwako vazive.",
  },
  "voice.arrivedDismiss": { en: "Not yet", sn: "Kwete izvozvi" },
  "share.statusArrived": { en: "Arrived safely", sn: "Vasvika zvakanaka" },
  "share.sendCta": { en: "Send the link", sn: "Tumira link" },
  "share.copyCta": { en: "Copy the link", sn: "Kopa link" },
  "share.copiedNote": { en: "Copied", sn: "Yakopwa" },

  "family.title": { en: "Family", sn: "Mhuri" },
  "family.chip": {
    en: "Guardian sees your trips",
    sn: "Muchengeti anoona nzendo dzako",
  },
  "family.asChildH": { en: "Who sees your trips", sn: "Ndiani anoona nzendo dzako" },
  "family.asChildNone": {
    en: "No one. A guardian only ever sees your trips after you both agree, and your app always shows a chip while it is on.",
    sn: "Hapana. Muchengeti anoona nzendo dzako chete kana mabvumirana mese, uye app yako inogara ichiratidza chip kana zviri kushanda.",
  },
  "family.linkedSince": { en: "Linked", sn: "Yakabatanidzwa" },
  "family.endCta": { en: "End this link", sn: "Gumisa kubatana uku" },
  "family.acceptH": {
    en: "Got a code from a guardian?",
    sn: "Une code kubva kumuchengeti?",
  },
  "family.acceptB": {
    en: "Entering it lets them see your trips: booked, on the kombi, arrived. Never where your phone is. You can end it at any time.",
    sn: "Kuisa code kunovarega vachiona nzendo dzako: yabhukwa, mukombi, wasvika. Kwete pane foni yako. Unogona kuzvigumisa chero nguva.",
  },
  "family.codeLabel": { en: "Invite code", sn: "Code yekukoka" },
  "family.acceptCta": { en: "Confirm the link", sn: "Simbisa kubatana" },
  "family.acceptOk": {
    en: "Linked. {name} now sees your trips, and this screen is where you end it.",
    sn: "Zvabatana. {name} ava kuona nzendo dzako, uye peji rino ndipo paunozvigumisa.",
  },
  "family.errInvalid": {
    en: "That code did not work.",
    sn: "Code iyoyo haina kushanda.",
  },
  "family.errLimited": {
    en: "Too many tries. Wait a few minutes.",
    sn: "Waedza kakawanda. Mirira maminitsi mashoma.",
  },
  "family.guardianH": { en: "Watch over someone", sn: "Chengeta mumwe munhu" },
  "family.guardianB": {
    en: "Create a code and give it to them. The link only starts when they confirm it on their own phone, and their app always shows them it is on.",
    sn: "Gadzira code wovapa. Kubatana kunotanga chete kana vakasimbisa pafoni yavo, uye app yavo inogara ichivaratidza kuti kuri kushanda.",
  },
  "family.inviteCta": { en: "Create an invite code", sn: "Gadzira code yekukoka" },
  "family.inviteLabel": {
    en: "Give this code to the person you will watch over",
    sn: "Ipa code iyi kumunhu waunochengeta",
  },
  "family.inviteExpiry": {
    en: "The code works for 7 days.",
    sn: "Code inoshanda kwemazuva manomwe.",
  },
  "family.cancelInvite": { en: "Cancel this code", sn: "Kanzura code iyi" },
  "family.tripsH": { en: "Their trips", sn: "Nzendo dzavo" },
  "family.tripsNone": {
    en: "No trips in the last day. When they ride, you see it here.",
    sn: "Hapana nzendo muzuva rapfuura. Kana vakakwira, unozviona pano.",
  },
  "family.state.booked": {
    en: "Booked, not boarded yet",
    sn: "Yabhukwa, havasati vakwira",
  },
  "family.state.riding": { en: "On the kombi", sn: "Vari mukombi" },
  "family.state.late": {
    en: "Taking longer than usual. This flags the trip, not anyone on it.",
    sn: "Rwendo ruri kutora nguva kupfuura zvakajairika. Izvi zvinoratidza rwendo, kwete munhu.",
  },
  "family.state.arrived": { en: "Arrived safely", sn: "Vasvika zvakanaka" },
  "family.state.ended": {
    en: "The trip ended without an arrival check-in. If you are unsure, reach them the way you usually would.",
    sn: "Rwendo rwakapera pasina kusimbisa kusvika. Kana usina chokwadi, vabate nenzira yaunowanzoita.",
  },
  "family.doorLabel": { en: "Family", sn: "Mhuri" },

  // --- guest mode (batch V2): look around first, sign in when it matters --
  "guest.whyH": { en: "Why an account exists", sn: "Sei account iripo" },
  "guest.why": {
    en: "So Svika can remember you: your trips, your tickets, your wallet. Looking around needs none of that.",
    sn: "Kuti Svika ikuyeuke: nzendo dzako, matikiti ako, chikwama chako. Kungotarisa hakudi chimwe chazvo.",
  },
  "guest.why.pay": {
    en: "Paying needs an account: your ticket and your money have to belong to you.",
    sn: "Kubhadhara kunoda account: tikiti rako nemari yako zvinofanira kuva zvako.",
  },
  "guest.why.save": {
    en: "Saving a trip needs an account: it has to be remembered as yours.",
    sn: "Kuchengeta rwendo kunoda account: runofanira kuyeukwa serwako.",
  },
  "guest.why.record": {
    en: "Recording a journey needs an account: the trace belongs to you, and only you can delete it.",
    sn: "Kurekodha rwendo kunoda account: nzira ndeyako, uye ndiwe chete unogona kuidzima.",
  },
  "guest.why.name": {
    en: "Naming a place needs an account: the name stays yours until the community agrees.",
    sn: "Kutumidza nzvimbo kunoda account: zita rinoramba riri rako kusvika nharaunda yabvumirana.",
  },
  "guest.signInCta": { en: "Sign in with your phone", sn: "Pinda nefoni yako" },
  "guest.signInChip": { en: "Sign in", sn: "Pinda" },
  "guest.planPayCta": { en: "Sign in to pay", sn: "Pinda kuti ubhadhare" },
  "guest.saveLink": {
    en: "Sign in to save this trip",
    sn: "Pinda kuti uchengete rwendo urwu",
  },
  "guest.recordLink": {
    en: "Sign in to record a journey",
    sn: "Pinda kuti urekodhe rwendo",
  },
  "guest.shareDoor": {
    en: "Plan your own trip on Svika",
    sn: "Ronga rwendo rwako paSvika",
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
