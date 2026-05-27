from enum import Enum

class DistanceMetric(Enum):
    Cosine = "Cosine"
    Euclidean = "Euclidean"
    Dot = "Dot"

class MatchType(Enum):
    must = "must"
    any = "any"