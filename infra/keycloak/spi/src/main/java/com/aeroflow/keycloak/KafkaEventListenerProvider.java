package com.aeroflow.keycloak;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.jboss.logging.Logger;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.admin.AdminEvent;

import java.util.HashMap;
import java.util.Map;

public class KafkaEventListenerProvider implements EventListenerProvider {

    private static final Logger log = Logger.getLogger(KafkaEventListenerProvider.class);

    private final KafkaProducer<String, String> producer;
    private final String topic;
    private final ObjectMapper mapper = new ObjectMapper();

    public KafkaEventListenerProvider(KafkaProducer<String, String> producer, String topic) {
        this.producer = producer;
        this.topic    = topic;
    }

    @Override
    public void onEvent(Event event) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type",      event.getType() != null ? event.getType().toString() : "UNKNOWN");
            payload.put("realmId",   event.getRealmId());
            payload.put("clientId",  event.getClientId());
            payload.put("userId",    event.getUserId());
            payload.put("sessionId", event.getSessionId());
            payload.put("ipAddress", event.getIpAddress());
            payload.put("time",      event.getTime());
            payload.put("details",   event.getDetails());

            if (event.getError() != null) {
                payload.put("error", event.getError());
            }

            String json = mapper.writeValueAsString(payload);
            producer.send(new ProducerRecord<>(topic, event.getUserId(), json));
            producer.flush();

            log.debugf("Published event type=%s user=%s to %s",
                    event.getType(), event.getUserId(), topic);

        } catch (Exception e) {
            log.errorf(e, "Failed to publish Keycloak event to Kafka topic %s: %s", topic, e.getMessage());
        }
    }

    @Override
    public void onEvent(AdminEvent adminEvent, boolean includeRepresentation) {
        // Admin events are not forwarded to the audit topic
    }

    @Override
    public void close() {
        // Producer lifecycle is managed by the factory
    }
}
