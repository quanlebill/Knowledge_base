"""
Kafka connector — follows the DatabaseConnector protocol.
URL format: kafka://host:port  or  host:port  (comma-separated for multiple brokers)
Two classes: KafkaProducerClient (for publishing events) and KafkaConsumerClient (for consuming).
"""
import asyncio
import json
from typing import Callable, Awaitable
from urllib.parse import urlparse

from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from aiokafka.errors import KafkaConnectionError

from basemodel.services_databaseconnector.shared_model import RetryConfig, HealthCheckLoopConfig
from services.log_set_up import create_logger

log = create_logger("services.kafka", "service_kafka")


def _parse_bootstrap(url: str) -> str:
    """Accept kafka://host:port or host:port or host1:port1,host2:port2."""
    if url.startswith("kafka://"):
        parsed = urlparse(url)
        return f"{parsed.hostname}:{parsed.port}"
    return url


# ── Producer ──────────────────────────────────────────────────────────────────

class KafkaProducerClient:
    __slots__ = ("_producer", "_bootstrap", "_connected", "_healthy", "_url")

    def __init__(self) -> None:
        self._producer: AIOKafkaProducer | None = None
        self._bootstrap: str | None = None
        self._connected: bool = False
        self._healthy: bool = False
        self._url: str | None = None

    def set_url(self, url: str) -> None:
        self._url = url
        self._bootstrap = _parse_bootstrap(url)

    async def _create_producer(self) -> AIOKafkaProducer:
        producer = AIOKafkaProducer(
            bootstrap_servers=self._bootstrap,
            value_serializer=lambda v: json.dumps(v).encode(),
            key_serializer=lambda k: k.encode() if k else None,
            enable_idempotence=True,
        )
        await producer.start()
        return producer

    async def open(self, retry: RetryConfig = RetryConfig()) -> "KafkaProducerClient":
        if self._bootstrap is None:
            raise RuntimeError("Kafka URL not set — call set_url() first")
        if self._producer is not None:
            return self
        for attempt in range(retry.count):
            try:
                self._producer = await self._create_producer()
                self._connected = True
                self._healthy = True
                log.info("Kafka producer connected bootstrap=%s", self._bootstrap)
                return self
            except Exception as e:
                log.info("Attempt #%d/%d: Kafka producer failed — %s", attempt + 1, retry.count, e)
                await asyncio.sleep(3)
        raise ConnectionError(f"Kafka producer could not connect after {retry.count} attempts")

    async def close(self) -> None:
        if self._producer is not None:
            await self._producer.stop()
            self._producer = None
        self._connected = False
        self._healthy = False
        log.info("Kafka producer closed")

    async def _check_health(self, config: HealthCheckLoopConfig) -> None:
        # Flush with timeout to verify the connection is live
        await asyncio.wait_for(self._producer.flush(), timeout=config.timeout_for_health_check)

    async def _reconnect(self) -> None:
        await self.close()
        try:
            self._producer = await self._create_producer()
            self._connected = True
            self._healthy = True
        except Exception as e:
            log.warning("Kafka producer reconnect failed: %s", e)

    async def health_check_loop(self, config: HealthCheckLoopConfig = HealthCheckLoopConfig()) -> None:
        log.info("Kafka producer health check loop started")
        while True:
            try:
                await self._check_health(config)
                self._healthy = True
            except Exception as e:
                self._healthy = False
                log.warning("Kafka producer unhealthy: %s — reconnecting", e)
                await self._reconnect()
            await asyncio.sleep(config.interval)

    def is_healthy(self) -> bool:
        return self._healthy

    def is_connected(self) -> bool:
        return self._connected

    def get_client(self) -> AIOKafkaProducer:
        if self._producer is None:
            raise RuntimeError("KafkaProducerClient not open")
        return self._producer

    async def produce(self, topic: str, value: dict, key: str | None = None) -> None:
        if self._producer is None:
            raise RuntimeError("KafkaProducerClient not open")
        await self._producer.send_and_wait(topic, value=value, key=key)
        log.info("Kafka produced topic=%s key=%s", topic, key)


# ── Consumer ──────────────────────────────────────────────────────────────────

class KafkaConsumerClient:
    __slots__ = ("_consumer", "_bootstrap", "_group_id", "_connected", "_healthy", "_url")

    def __init__(self) -> None:
        self._consumer: AIOKafkaConsumer | None = None
        self._bootstrap: str | None = None
        self._group_id: str = "kb-ingestion"
        self._connected: bool = False
        self._healthy: bool = False
        self._url: str | None = None

    def set_url(self, url: str) -> None:
        self._url = url
        self._bootstrap = _parse_bootstrap(url)

    def set_group_id(self, group_id: str) -> None:
        self._group_id = group_id

    def _make_consumer(self, *topics: str) -> AIOKafkaConsumer:
        return AIOKafkaConsumer(
            *topics,
            bootstrap_servers=self._bootstrap,
            group_id=self._group_id,
            value_deserializer=lambda v: json.loads(v.decode()),
            auto_offset_reset="earliest",
            enable_auto_commit=True,
        )

    async def open(self, retry: RetryConfig = RetryConfig()) -> "KafkaConsumerClient":
        if self._bootstrap is None:
            raise RuntimeError("Kafka URL not set — call set_url() first")
        # Validate connection by creating a temporary consumer and checking metadata
        for attempt in range(retry.count):
            try:
                probe = self._make_consumer()
                await probe.start()
                await probe.stop()
                self._connected = True
                self._healthy = True
                log.info("Kafka consumer validated bootstrap=%s group=%s", self._bootstrap, self._group_id)
                return self
            except Exception as e:
                log.info("Attempt #%d/%d: Kafka consumer probe failed — %s", attempt + 1, retry.count, e)
                await asyncio.sleep(3)
        raise ConnectionError(f"Kafka consumer could not connect after {retry.count} attempts")

    async def close(self) -> None:
        if self._consumer is not None:
            await self._consumer.stop()
            self._consumer = None
        self._connected = False
        self._healthy = False
        log.info("Kafka consumer closed")

    async def _check_health(self, config: HealthCheckLoopConfig) -> None:
        if self._consumer is None:
            raise RuntimeError("No active consumer")
        await asyncio.wait_for(
            asyncio.shield(self._consumer.getmany(timeout_ms=500)),
            timeout=config.timeout_for_health_check,
        )

    async def health_check_loop(self, config: HealthCheckLoopConfig = HealthCheckLoopConfig()) -> None:
        log.info("Kafka consumer health check loop started")
        while True:
            try:
                if self._consumer is not None:
                    self._healthy = True
                else:
                    self._healthy = False
            except Exception as e:
                self._healthy = False
                log.warning("Kafka consumer unhealthy: %s", e)
            await asyncio.sleep(config.interval)

    def is_healthy(self) -> bool:
        return self._healthy

    def is_connected(self) -> bool:
        return self._connected

    def get_client(self) -> AIOKafkaConsumer:
        if self._consumer is None:
            raise RuntimeError("No active consumer — call start_consuming() first")
        return self._consumer

    async def start_consuming(
        self,
        topics: list[str],
        handler: Callable[[dict], Awaitable[None]],
    ) -> None:
        """Subscribe to topics and run handler for each message. Runs forever (call as create_task)."""
        self._consumer = self._make_consumer(*topics)
        await self._consumer.start()
        self._connected = True
        self._healthy = True
        log.info("Kafka consumer started topics=%s group=%s", topics, self._group_id)
        try:
            async for message in self._consumer:
                try:
                    await handler(message.value)
                except Exception as e:
                    log.error("Kafka message handler error topic=%s: %s", message.topic, e)
        finally:
            await self._consumer.stop()
            self._consumer = None
            self._connected = False
            self._healthy = False


producer = KafkaProducerClient()
consumer = KafkaConsumerClient()
