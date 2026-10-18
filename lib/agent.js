// Construye la configuración de la recepcionista (prompt + herramientas) a partir de los datos del negocio.
// Un agente de Retell por negocio. Se sincroniza con /api/admin/sync-agent.
import { WEEKDAY_KEYS } from './time.js';

const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function hoursText(hours = {}) {
  return ORDER.map((k) => {
    const r = hours[k] || [];
    return `${DAY_NAMES[k]}: ${r.length ? r.map(([a, b]) => `${a}–${b}`).join(', ') : 'closed'}`;
  }).join('\n');
}

export function buildPrompt(biz) {
  const services = (biz.services || []).map((s) => `- ${s.name}: ${s.duration_min} min, €${s.price_eur}${s.notes ? ` (${s.notes})` : ''}`).join('\n');
  return `## Who you are
You are the virtual receptionist (an AI assistant) for ${biz.name}, ${biz.business_type || 'an appointment-based business'} in ${biz.city || 'Ireland'}.
You answer the phone, book, move and cancel appointments, answer simple questions and take messages. You speak Irish/British English, warm and efficient, like a good front-desk person.

## Hard rules
- If anyone asks, say clearly that you are an AI assistant. Never pretend to be a person.
- Never invent availability, prices or policies. Availability ONLY comes from check_availability. Prices and policies ONLY from this prompt.
- Keep every reply short: one or two sentences, then a question. This is a phone call.
- Say times like "two thirty in the afternoon" or "half ten", dates like "Thursday the twenty-third". Never read out codes, IDs or ISO dates.
- Before booking, read back the treatment, day and time and get a clear yes.
- The caller's number is {{user_number}}. Use it for the booking; only ask for another number if they want a different one, or if it is hidden.
- No medical, legal or financial advice. If the caller describes a medical emergency, tell them to call 112 or 999 and end politely.
- If you can't answer something or the caller needs a decision from the owner (special requests, complaints, refunds, prices not listed, group bookings), use ask_owner, then tell them you'll call back with an answer.
- If they just want to leave a message or speak to someone, use take_message. Get their name and what it's about.
- Never share other clients' details.
- If the line is silent or it's clearly a wrong number or spam, end the call politely.

## Booking flow
1. Find out the treatment and the day (and part of the day if they have a preference).
2. Call check_availability. Offer at most three of the returned times.
3. When they choose, confirm name, treatment, day and time, then call book_appointment with the exact "start" value returned by check_availability.
4. After booking, confirm the day and time once${biz.deposit_eur ? `, and mention that a €${biz.deposit_eur} deposit secures the booking and they'll receive the payment link by text or email` : ''}.

To change or cancel: call find_appointments first, confirm which booking, then reschedule_appointment (after check_availability for the new day) or cancel_appointment.${biz.cancel_policy_hours ? ` Cancellation policy: free up to ${biz.cancel_policy_hours} hours before. ${biz.late_cancel_note || ''}` : ''}

## The business
Name: ${biz.name}
Address: ${biz.address || 'given in the booking confirmation'}
Opening hours:
${hoursText(biz.hours)}
Treatments:
${services || '- (none configured)'}
${biz.faq ? `\nOther information:\n${biz.faq}\n` : ''}
## Call-back mode
If {{call_mode}} is "callback": you are calling {{caller_name}} back. Context of their earlier call: {{callback_context}}. The owner's answer: {{owner_instruction}}. Give them the owner's answer clearly, help with anything that follows from it (for example booking), and end the call. If the owner's answer is empty, apologise and take a message. If you reach a voicemail, leave a short message saying who you are and that you'll try again, then end the call.

Current time in Ireland: {{current_time_Europe/Dublin}}`;
}

const params = {
  check_availability: {
    description: 'Check free appointment times for a treatment on a day. Always call this before offering times.',
    parameters: { type: 'object', properties: {
      service: { type: 'string', description: 'Treatment name as the caller said it, matched to the treatment list' },
      day: { type: 'string', description: 'Day requested: "today", "tomorrow", a weekday like "friday", or a date YYYY-MM-DD' },
      preferred_time: { type: 'string', description: 'Optional: "morning", "afternoon", "evening" or a time like "14:30"' },
    }, required: ['service', 'day'] },
    speak: 'Say you are checking the diary, in a few words.',
  },
  book_appointment: {
    description: 'Book the appointment once the caller has confirmed treatment, day and time.',
    parameters: { type: 'object', properties: {
      service: { type: 'string', description: 'Treatment name' },
      start: { type: 'string', description: 'Exact "start" value returned by check_availability, e.g. 2026-10-23T14:30' },
      client_name: { type: 'string', description: "Client's first and last name" },
      client_phone: { type: 'string', description: 'Only if the caller wants a different number from the one they are calling from' },
      notes: { type: 'string', description: 'Optional short note for the business (e.g. first visit, allergy mentioned)' },
    }, required: ['service', 'start', 'client_name'] },
    speak: 'Say you are booking it now, in a few words.',
  },
  find_appointments: {
    description: "Find the caller's upcoming bookings (by their phone number).",
    parameters: { type: 'object', properties: { client_phone: { type: 'string', description: 'Only if the booking was made with a different number' } }, required: [] },
    speak: 'Say you are looking it up.',
  },
  reschedule_appointment: {
    description: 'Move an existing booking to a new free time (check availability for the new day first).',
    parameters: { type: 'object', properties: {
      appointment_id: { type: 'string', description: 'appointment_id from find_appointments' },
      new_start: { type: 'string', description: 'Exact "start" value from check_availability' },
    }, required: ['appointment_id', 'new_start'] },
    speak: 'Say you are moving it now.',
  },
  cancel_appointment: {
    description: 'Cancel an existing booking after the caller confirms.',
    parameters: { type: 'object', properties: { appointment_id: { type: 'string', description: 'appointment_id from find_appointments' } }, required: ['appointment_id'] },
    speak: null,
  },
  take_message: {
    description: 'Leave a message for the business when the caller wants a call back or something you cannot do.',
    parameters: { type: 'object', properties: {
      caller_name: { type: 'string', description: "Caller's name" },
      caller_phone: { type: 'string', description: 'Only if different from the number they are calling from' },
      message: { type: 'string', description: 'What it is about, in one or two sentences' },
      urgency: { type: 'string', enum: ['low', 'normal', 'urgent'], description: 'How urgent' },
    }, required: ['caller_name', 'message'] },
    speak: null,
  },
  ask_owner: {
    description: 'Ask the owner to decide something you cannot answer. The owner replies in the dashboard and you call the client back.',
    parameters: { type: 'object', properties: {
      caller_name: { type: 'string', description: "Caller's name" },
      caller_phone: { type: 'string', description: 'Only if different from the number they are calling from' },
      question: { type: 'string', description: 'The exact question or request for the owner, in one sentence' },
      context: { type: 'string', description: 'Short context the owner needs to decide' },
    }, required: ['caller_name', 'question'] },
    speak: null,
  },
};

export function buildTools(biz, baseUrl, secret) {
  const tools = Object.entries(params).map(([name, p]) => ({
    type: 'custom', name, description: p.description,
    url: `${baseUrl}/api/voice/tool?biz=${encodeURIComponent(biz.slug)}&fn=${name}`,
    method: 'POST', headers: { 'x-flowserve-secret': secret },
    parameters: p.parameters,
    speak_during_execution: !!p.speak, ...(p.speak ? { execution_message_description: p.speak } : {}),
    speak_after_execution: true, timeout_ms: 12000,
  }));
  tools.push({ type: 'end_call', name: 'end_call', description: 'End the call once the caller has what they need and has said goodbye.' });
  if (biz.transfer_number) {
    tools.push({ type: 'transfer_call', name: 'transfer_to_owner', description: 'Only for urgent matters the owner must handle live, during opening hours.',
      transfer_destination: { type: 'predefined', number: biz.transfer_number }, transfer_option: 'cold_transfer' });
  }
  return tools;
}

export function beginMessage(biz) {
  return biz.greeting || `Hi, you're through to ${biz.name}. I'm the virtual assistant, an AI, and this call is transcribed so we can help you. How can I help?`;
}

export function buildLlmBody(biz, baseUrl, secret) {
  return {
    model: biz.llm_model || 'gpt-4.1-mini',
    start_speaker: 'agent',
    begin_message: beginMessage(biz),
    general_prompt: buildPrompt(biz),
    general_tools: buildTools(biz, baseUrl, secret),
    default_dynamic_variables: { call_mode: 'inbound', caller_name: '', callback_context: '', owner_instruction: '' },
  };
}

export function buildAgentBody(biz, llmId, baseUrl, webhookKey) {
  return {
    agent_name: `FlowServe · ${biz.name}`,
    response_engine: { type: 'retell-llm', llm_id: llmId },
    voice_id: biz.voice_id || 'retell-Cimo',
    language: 'en-GB',
    webhook_url: `${baseUrl}/api/voice/webhook?key=${encodeURIComponent(webhookKey)}`,
    webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
    max_call_duration_ms: 10 * 60 * 1000,
    end_call_after_silence_ms: 20000,
    interruption_sensitivity: 0.9,
    post_call_analysis_data: [
      { type: 'string', name: 'outcome', description: 'One word: booked, rescheduled, cancelled, message, escalated, info, spam or other' },
      { type: 'string', name: 'caller_name', description: "Caller's name if they gave it, else empty" },
    ],
  };
}

/** Lo que se dice al empezar una devolución de llamada. */
export function callbackBegin(biz) {
  return `Hi, is that {{caller_name}}? This is the virtual assistant from ${biz.name}, an AI, calling you back about your earlier question.`;
}

export { WEEKDAY_KEYS };
