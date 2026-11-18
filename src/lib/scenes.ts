import type { Register } from "./types";

export interface Twist {
  id: string;
  label: string; // shown to the learner
  direction: string; // what the AI partner should do to create it
}

export interface KeyPhrase {
  text: string;
  longVersion: string;
  register: Register;
}

export interface Scene {
  id: string;
  title: string;
  setting: string; // "Coffee & food"
  goal: string;
  partner: string; // who the AI plays
  partnerName: string;
  partnerInitial: string;
  persona: string; // instructions for the AI
  opening: string; // the AI's first line
  rules: string[];
  keyPhrases: KeyPhrase[];
  twists: Twist[];
}

export const SCENES: Scene[] = [
  {
    id: "coffee",
    title: "Coffee shop",
    setting: "Coffee & food",
    goal: "Order exactly what you want and enjoy the chat.",
    partner: "Barista",
    partnerName: "Jordan",
    partnerInitial: "B",
    persona:
      "You are Jordan, a friendly barista in his late 20s at a busy independent coffee shop in Brooklyn. Fast, warm, a little chatty when the line is short. You use everyday coffee-shop shorthand (\"for here or to go?\", \"room for milk?\", \"you're all set\").",
    opening: "Hey! What can I get started for you?",
    rules: [
      "\"Can I get…\" is the default way to order. \"I would like…\" sounds stiff at a counter.",
      "The tipping screen is normal. At a counter, \"No tip\" or a quick 15–20% are both fine; nobody watches.",
      "\"How's it going?\" from a barista is a greeting, not a question. \"Good, you?\" is the whole answer.",
      "Drinks are named by the milk: an \"oat latte\", an \"iced almond cortado\".",
    ],
    keyPhrases: [
      { text: "Can I get a…", longVersion: "I would like to order one…", register: "Neutral" },
      { text: "That's it for me.", longVersion: "I don't need to order anything else.", register: "Casual" },
      { text: "For here.", longVersion: "I will drink it inside the shop.", register: "Casual" },
      { text: "Room for milk?", longVersion: "Should I leave some space in the cup so you can add milk?", register: "Casual" },
      { text: "my go-to", longVersion: "the drink I always order when I come here", register: "Casual" },
      { text: "No worries.", longVersion: "That is okay, it is not a problem for me.", register: "Casual" },
    ],
    twists: [
      { id: "order", label: "Placing the order", direction: "Take their order and confirm the size." },
      { id: "here-or-go", label: "For here or to go?", direction: "Ask whether it's for here or to go." },
      { id: "name", label: "Name for the order", direction: "Ask for a name for the cup." },
      { id: "out-of", label: "They're out of something", direction: "Apologize: you're out of the milk or pastry they picked; offer two alternatives." },
      { id: "custom", label: "A custom order", direction: "Ask a follow-up about customization: sweetness, extra shot, hot or iced, room for milk." },
      { id: "size-names", label: "Size names", direction: "Mention the sizes are 12 or 16 ounce, or small/large, and ask which." },
      { id: "recommend", label: "Asking for a recommendation", direction: "If they seem unsure, recommend a seasonal drink and describe it casually." },
      { id: "pastry", label: "Upsell: something to eat?", direction: "Offer a pastry or ask if they want anything to eat with that." },
      { id: "card", label: "Paying: card machine", direction: "Tell them to tap or insert whenever they're ready; the card fails once and needs a retry." },
      { id: "tip", label: "The tipping screen", direction: "Turn the tablet around: \"It's just gonna ask you a quick question.\" (the tip screen)." },
      { id: "wrong-drink", label: "The wrong drink", direction: "Later, hand over a drink that is slightly wrong (e.g. dairy instead of oat). Let them correct you politely." },
      { id: "mobile", label: "Mobile-order mix-up", direction: "Ask if they're picking up a mobile order, since there's one under a similar name." },
      { id: "wifi", label: "Wi-Fi or restroom", direction: "Be open to a question about the Wi-Fi password or the restroom code; it's on the receipt." },
      { id: "weekend", label: "\"Any plans this weekend?\"", direction: "While making the drink, ask about their weekend plans and share a small detail about yours." },
      { id: "regular", label: "\"The usual?\"", direction: "Act like you've seen them before: \"Same as last time?\"" },
      { id: "weather", label: "Small talk about the weather", direction: "Comment on the weather outside in a casual way." },
      { id: "wait", label: "It'll be a few minutes", direction: "Tell them there's a bit of a wait because the espresso machine is backed up." },
      { id: "goodbye", label: "Wrapping up", direction: "Hand over the drink and close warmly (\"You're all set, have a good one\")." },
    ],
  },
  {
    id: "restaurant",
    title: "Restaurant",
    setting: "Coffee & food",
    goal: "Get a table, order well, and handle the check like a local.",
    partner: "Server",
    partnerName: "Alex",
    partnerInitial: "S",
    persona:
      "You are Alex, an upbeat server at a sit-down neighborhood restaurant in Chicago. Professional but casual; you check in a lot (\"How's everything tasting?\").",
    opening: "Hi there! Just the two of you tonight, or is anyone else joining?",
    rules: [
      "Servers check in often; \"We're good, thanks!\" is a complete answer.",
      "Tipping 18–20% is expected for table service; it's added on the card slip after you pay.",
      "\"Can we get the check?\" is normal; servers rarely bring it unasked.",
      "Asking to box leftovers is normal: \"Could I get a box for this?\"",
    ],
    keyPhrases: [
      { text: "Could we get a few more minutes?", longVersion: "We have not decided yet, please give us more time to decide.", register: "Neutral" },
      { text: "I'll have the…", longVersion: "I would like to order the…", register: "Neutral" },
      { text: "We're good, thanks!", longVersion: "We don't need anything right now, everything is fine.", register: "Casual" },
      { text: "Can we get the check?", longVersion: "Could you bring us the bill so that we can pay?", register: "Neutral" },
      { text: "Could I get a box for this?", longVersion: "Can you give me a container so I can take the rest home?", register: "Neutral" },
      { text: "Can we split it?", longVersion: "Is it possible for each of us to pay separately?", register: "Neutral" },
    ],
    twists: [
      { id: "party", label: "How many in your party?", direction: "Ask how many people and whether they have a reservation." },
      { id: "wait-table", label: "A wait for a table", direction: "Say there's a 15–20 minute wait; offer the bar or a text when the table's ready." },
      { id: "inside-out", label: "Inside or patio?", direction: "Ask if they'd prefer inside or the patio." },
      { id: "drinks-first", label: "Drinks first", direction: "Ask if they want to start with something to drink." },
      { id: "water", label: "Still or sparkling?", direction: "Ask \"Still or sparkling?\" for water." },
      { id: "specials", label: "Tonight's specials", direction: "Describe two specials briefly and naturally." },
      { id: "more-time", label: "Needing more time", direction: "Come back to take the order before they're ready." },
      { id: "allergy", label: "An allergy or diet question", direction: "Be ready to answer a question about nuts, gluten, or making a dish vegetarian." },
      { id: "how-cooked", label: "How would you like it cooked?", direction: "Ask how they want the steak or burger cooked, or which side." },
      { id: "check-in", label: "\"How's everything tasting?\"", direction: "Check in mid-meal: \"How's everything tasting?\"" },
      { id: "send-back", label: "Something's wrong with the dish", direction: "Let them politely raise an issue (cold, wrong item); apologize and fix it." },
      { id: "dessert", label: "Room for dessert?", direction: "Offer dessert or coffee." },
      { id: "check", label: "Asking for the check", direction: "Bring the check when asked, or ask if they want it." },
      { id: "split", label: "Splitting the check", direction: "Ask if it's all together or separate checks." },
      { id: "box", label: "Boxing leftovers", direction: "Offer a box for the leftovers." },
      { id: "goodbye", label: "Saying goodbye", direction: "Thank them and close warmly." },
    ],
  },
  {
    id: "bar",
    title: "Bar",
    setting: "Going out",
    goal: "Order drinks easily and handle a crowded bar.",
    partner: "Bartender",
    partnerName: "Sam",
    partnerInitial: "B",
    persona:
      "You are Sam, a quick, dry-humored bartender at a busy neighborhood bar in Austin on a Friday night. Short sentences; you keep things moving.",
    opening: "Hey, what are we drinking?",
    rules: [
      "Tip about $1–2 per drink, or 20% on a tab.",
      "\"Can I open a tab?\" means they hold your card and you pay at the end.",
      "Make eye contact and be ready with your order; waving cash or snapping reads as rude.",
      "\"What do you have on draft?\" asks which beers are on tap.",
    ],
    keyPhrases: [
      { text: "What do you have on draft?", longVersion: "Which beers do you serve from the tap?", register: "Neutral" },
      { text: "I'll do a…", longVersion: "I would like to order a…", register: "Casual" },
      { text: "Can I open a tab?", longVersion: "Can I pay for everything at the end of the night?", register: "Neutral" },
      { text: "Can I close out?", longVersion: "I am ready to pay for my tab now.", register: "Casual" },
      { text: "Surprise me.", longVersion: "You can choose the drink for me, I trust you.", register: "Casual" },
    ],
    twists: [
      { id: "order", label: "Ordering a drink", direction: "Take a drink order." },
      { id: "draft", label: "What's on draft?", direction: "List three beers on tap in a quick, natural way." },
      { id: "recommend", label: "\"What do you recommend?\"", direction: "Recommend something based on what they like." },
      { id: "id", label: "Checking ID", direction: "Ask to see their ID." },
      { id: "tab", label: "Open or close a tab", direction: "Ask whether they want to open a tab or close out." },
      { id: "out-of", label: "Out of something", direction: "Say you're out of the thing they asked for and offer something similar." },
      { id: "loud", label: "Loud and busy", direction: "Mishear them once because it's loud and ask them to repeat." },
      { id: "happy-hour", label: "Happy hour", direction: "Mention happy hour ends in 10 minutes." },
      { id: "another", label: "\"Another round?\"", direction: "Ask if they want another round." },
      { id: "water", label: "Water and the check", direction: "Respond to a request for water or the check." },
      { id: "small-talk", label: "Bar small talk", direction: "Make a quick comment about the game on TV or the crowd." },
      { id: "goodbye", label: "Heading out", direction: "Close out and say goodbye." },
    ],
  },
  {
    id: "rideshare",
    title: "Rideshare",
    setting: "Getting around",
    goal: "Find the right car and keep the ride pleasant.",
    partner: "Driver",
    partnerName: "Mike",
    partnerInitial: "D",
    persona:
      "You are Mike, a friendly Uber driver in his 40s in Los Angeles. You confirm the name, check the destination, and make easy small talk unless the rider seems quiet.",
    opening: "Hey there! Can I get your name real quick? Just making sure you're my ride.",
    rules: [
      "Confirm with \"Are you here for…?\" or by name before getting in.",
      "Small talk is optional; \"Long day — mind if I just chill?\" is polite.",
      "Tipping happens in the app after the ride.",
      "Riders usually sit in the back.",
    ],
    keyPhrases: [
      { text: "Are you here for…?", longVersion: "Are you the driver who is supposed to pick me up?", register: "Neutral" },
      { text: "You can drop me here.", longVersion: "It is okay to stop the car here, I will get out at this place.", register: "Casual" },
      { text: "Mind if I…?", longVersion: "Would it be a problem for you if I…?", register: "Neutral" },
      { text: "Right up here on the left.", longVersion: "The place is a short distance ahead on the left side.", register: "Casual" },
    ],
    twists: [
      { id: "confirm", label: "Confirming the ride", direction: "Confirm their name and destination." },
      { id: "pickup", label: "Pickup confusion", direction: "Say you're on the other side of the street and ask them to cross." },
      { id: "route", label: "Route choice", direction: "Ask if they have a route preference or mention traffic on the freeway." },
      { id: "music", label: "Music or temperature", direction: "Ask if the temperature or music is okay." },
      { id: "small-talk", label: "\"Where are you from?\"", direction: "Pick up on their accent and ask where they're from, friendly." },
      { id: "local", label: "Local recommendations", direction: "Recommend a food spot near the destination." },
      { id: "stop", label: "A quick stop", direction: "Respond if they ask for a quick stop or a change of destination." },
      { id: "dropoff", label: "Where to drop off", direction: "Ask exactly where they want to be dropped off." },
      { id: "goodbye", label: "Getting out", direction: "Say goodbye and wish them a good day." },
    ],
  },
  {
    id: "gym",
    title: "Gym",
    setting: "Everyday life",
    goal: "Share equipment, ask questions, and chat between sets.",
    partner: "Gym regular",
    partnerName: "Chris",
    partnerInitial: "G",
    persona:
      "You are Chris, a friendly regular at a neighborhood gym in Denver. Relaxed, encouraging, uses gym slang lightly (\"working in\", \"how many sets you got left?\").",
    opening: "Hey — how many sets you got left on that?",
    rules: [
      "\"Can I work in?\" means alternating sets on the same machine.",
      "Re-rack your weights and wipe down equipment; people notice.",
      "Keep chat short between sets; headphones mean \"not now\".",
      "Compliments are fine if they're about effort, not looks.",
    ],
    keyPhrases: [
      { text: "Can I work in?", longVersion: "Can we take turns using this machine between your sets?", register: "Neutral" },
      { text: "You using this?", longVersion: "Excuse me, are you currently using this equipment?", register: "Casual" },
      { text: "All yours.", longVersion: "I am finished, you can use it now.", register: "Casual" },
      { text: "Mind giving me a spot?", longVersion: "Could you stand behind me and help in case I can't lift the weight?", register: "Casual" },
      { text: "I'm wiped.", longVersion: "I am extremely tired.", register: "Casual" },
    ],
    twists: [
      { id: "sets-left", label: "How many sets left?", direction: "Ask how many sets they have left." },
      { id: "work-in", label: "Working in", direction: "Ask if you can work in with them." },
      { id: "spot", label: "Asking for a spot", direction: "Ask them for a spot on bench press." },
      { id: "form", label: "A form question", direction: "Ask them a casual question about form, or answer one." },
      { id: "routine", label: "Talking routines", direction: "Ask what they're training today (push/pull/legs) and share yours." },
      { id: "busy", label: "It's packed today", direction: "Comment that it's packed and ask if it's always like this when they come." },
      { id: "class", label: "Classes", direction: "Mention a class (spin, yoga) and ask if they've tried it." },
      { id: "goodbye", label: "Wrapping up", direction: "Say you're heading out and wish them a good workout." },
    ],
  },
  {
    id: "stranger",
    title: "Small talk with a stranger",
    setting: "Everyday life",
    goal: "Open, keep and close a short chat without it feeling scripted.",
    partner: "Stranger",
    partnerName: "Taylor",
    partnerInitial: "T",
    persona:
      "You are Taylor, a friendly American in your 30s. You're standing next to the learner in a long line at a food truck in San Francisco. Open, curious, a bit funny.",
    opening: "Oh man, this line is no joke. Have you been here before?",
    rules: [
      "Americans start chats with shared context: the line, the weather, the event.",
      "Ask a follow-up about what they said; that's what keeps it going.",
      "\"Nice talking to you!\" or \"Enjoy the rest of your day\" closes it cleanly.",
      "\"We should grab coffee sometime\" is friendly, not always a real plan.",
    ],
    keyPhrases: [
      { text: "Have you been here before?", longVersion: "Is this your first time visiting this place, or have you come before?", register: "Neutral" },
      { text: "What do you recommend?", longVersion: "Which item do you think I should choose?", register: "Neutral" },
      { text: "No way!", longVersion: "I am very surprised to hear that.", register: "Casual" },
      { text: "Nice talking to you!", longVersion: "I enjoyed our conversation, but I have to go now.", register: "Neutral" },
      { text: "lowkey", longVersion: "a little bit, but I don't want to say it too strongly", register: "Casual" },
    ],
    twists: [
      { id: "opener", label: "A shared-context opener", direction: "Open with a comment about the shared situation." },
      { id: "recommend", label: "Swapping recommendations", direction: "Recommend something on the menu or ask what they'd get." },
      { id: "where-from", label: "\"Where are you from?\"", direction: "Ask where they're from, naturally, and react with genuine interest." },
      { id: "work", label: "\"What do you do?\"", direction: "Ask what they do, casually." },
      { id: "weekend", label: "Weekend plans", direction: "Ask about their plans for the weekend." },
      { id: "local-tip", label: "A local tip", direction: "Share a local tip (a park, a show, a neighborhood)." },
      { id: "joke", label: "A light joke", direction: "Make a light joke about the wait or the weather." },
      { id: "common", label: "Finding something in common", direction: "Discover something in common and react (\"No way, me too!\")." },
      { id: "exit", label: "Closing the chat", direction: "Your turn is up; close the conversation warmly." },
    ],
  },
];

export const TOPICS = [
  { id: "weekend", title: "Weekend plans" },
  { id: "food", title: "Food & where to eat" },
  { id: "workouts", title: "Workouts & routines" },
  { id: "watching", title: "What you're watching" },
  { id: "travel", title: "Travel" },
];

export function getScene(id: string | null | undefined): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

/** Pick 2–4 twists not yet practiced (falls back to practiced ones once all are covered). */
export function planTwists(scene: Scene, covered: string[], pinned?: string): string[] {
  const fresh = scene.twists.filter((t) => !covered.includes(t.id) && t.id !== pinned);
  const pool = fresh.length >= 2 ? fresh : scene.twists.filter((t) => t.id !== pinned);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const count = 2 + Math.floor(Math.random() * 3);
  const picked = shuffled.slice(0, count).map((t) => t.id);
  return pinned ? [pinned, ...picked.slice(0, 3)] : picked;
}
