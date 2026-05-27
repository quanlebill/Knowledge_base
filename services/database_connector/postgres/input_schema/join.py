from pydantic import BaseModel, model_validator
from typing import Any, Literal, Optional


class SelectedColumn(BaseModel):
    table_name: str
    column_name: str
    alias: Optional[str] = None


class JoinOn(BaseModel):
    left_table: str
    left_column: str
    right_table: str
    right_column: str
    join_type: Literal["INNER", "LEFT", "RIGHT", "FULL"] = "INNER"


class WhereFilter(BaseModel):
    table_name: str
    column_name: str
    value: Any


class ReadJoinRequest(BaseModel):
    joins_table: list[str]
    join_on: list[JoinOn]
    selected_columns: list[SelectedColumn]
    filters: list[WhereFilter] = []
    limit: int = 50
    offset: int = 0
    order_by: Optional[str] = None

    @model_validator(mode="after")
    def _check_consistency(self):
        if len(self.joins_table) < 2:
            raise ValueError("joins_table must contain at least two table names")
        expected_joins = len(self.joins_table) - 1
        if len(self.join_on) != expected_joins:
            raise ValueError(
                f"join_on must have exactly {expected_joins} entry/entries "
                f"for {len(self.joins_table)} tables"
            )
        if not self.selected_columns:
            raise ValueError("selected_columns cannot be empty")
        table_set = set(self.joins_table)
        for col in self.selected_columns:
            if col.table_name not in table_set:
                raise ValueError(
                    f"selected_columns references unknown table '{col.table_name}'"
                )
        for f in self.filters:
            if f.table_name not in table_set:
                raise ValueError(
                    f"filters references unknown table '{f.table_name}'"
                )
        return self
