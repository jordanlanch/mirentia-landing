# X (Twitter) Content Templates — Week 1

These templates are ready to publish. Queue via Buffer/Hootsuite or post manually. Adjust hashtags and mentions based on engagement.

---

## Post 1: Architecture Thread

Cómo construimos el agente de Bailante en 3 semanas.

1/ El problema: Bailante recibía leads por WhatsApp. Owner copiaba a Excel. Agenda manual. 0% automatización.

2/ Decisión clave: NO hacer una app. Hacer un agente que se meta en WhatsApp y Google Calendar.

3/ Stack: Laravel + OpenAI + WhatsApp Cloud API + Google Calendar API.
No LangChain. No Autogen. Un while(true) con logs赢了。

4/ La máquina de estados que hizo la diferencia:
IDLE → INTERPRETING → SCHEDULING → CONFIRMING → DONE
Cada estado = 1 acción. Sin loops infinitos.

5/ Lo que se rompió primero: webhooks idempotentes.
WhatsApp reenvía. Sin SETNX + Redis, cada mensaje generaba 4 agentes en paralelo.

6/ Resultado: 14h/semana → 2h/semana.
+26% conversión de consulta a cita.
El agente no convenció mejor — eliminó la fricción.

🧵

#AI #Agents #WhatsApp #Automation #Laravel

---

## Post 2: Micro-Tutorial

Cómo clasificar intents de usuario en un agente de WhatsApp en 7 líneas de PHP:

```
$response = $openai->chat([
  'model' => 'gpt-4o',
  'messages' => [
    ['role' => 'system', 'content' => 'Clasifica: SOLICITAR_CITA, CONSULTAR_HORARIO, CANCELAR, REPROGRAMAR, OTRO'],
    ['role' => 'user', 'content' => $message->body]
  ]
]);
```

El prompt es minimalista a propósito. Cuanto más escribís, más se confunde el modelo.

Abajo: el match que deriva a cada estado.

#AI #GPT4 #PHP #WhatsApp

---

## Post 3: Hot Take

Hot take: el 90% de los "AI agents" que ves en Twitter son dashboards con un chatbos appended.

Un agente de verdad:
- Ejecuta tareas sin que vos intervengas
- Toma decisiones con información incompleta
- Maneja sus propios errores
- Te avisa cuando necesita un humano

Bailante: el agente agenda solo. 24/7. Sin que nadie toque el teléfono.

Eso es un agent. Lo demás es un widget con IA.

#AI #Agents #Startup

---

## Post 4: Anecdote

Lunes pasado: 11pm. Me llega un mensaje de WhatsApp de Bailante.

"Isabel pregunta si puede reprogramar su clase de mañana."

El agente ya le había confirmado a Isabel. Ya había actualizado Google Calendar. Ya había enviado recordatorio.

Yo estaba cenando. El agente no.

A las 11pm, el agente estaba funcionando. Yo no tenía que hacer nada.

Esa es la diferencia entre un proceso manual y uno automatizado: la hora en que te enterás del problema.

#Automation #WhatsApp #AI #Startup

---

## Post 5: Repost / Engagement

Vía @somecolleague: "We spent 3 months building an AI agent. It still asks users to repeat themselves 40% of the time."

The problem isn't the AI. It's the state machine.

If your agent can't classify intent reliably, no LLM in the world will save it.

Fix the state machine first. Everything else is optimization.

(h/t whoever said this first — couldn't find the original tweet)

#AI #Engineering #LLM

---

## Notes

- Post 1 and 4 tie to the Bailante case study (mirentia.com/cases/bailante)
- Post 2 can link to the full code when the GitHub org is live (PR-4)
- Post 5 is for engagement with the LatAm/US tech community
- Hashtags kept minimal — Twitter algo favors fewer tags on hot takes
- All posts in Spanish except Post 5 (engagement play)
