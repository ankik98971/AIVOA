from pydantic import BaseModel
from typing import Optional

# Pydantic schema for creating a new complaint and returning it
class ComplaintBase(BaseModel):
    complaint_source: str = "Not Provided"
    customer_name: str = "Not Provided"
    product_name: str = "Not Provided"
    product_strength_grade: str = "Not Provided"
    batch_lot_number: str = "Not Provided"
    affected_quantity: str = "Not Provided"
    manufacturing_date: str = "Not Provided"
    expiry_date: str = "Not Provided"
    originating_site_block: str = "Not Provided"
    impacted_non_product_materials: str = "Not Provided"
    complaint_category: str = "Not Provided"
    complaint_description: str = "Not Provided"
    ai_severity: str = "Not Provided"
    ai_suggested_next_action: str = "Not Provided"
    ai_initial_risk_assessment: str = "Not Provided"

class ComplaintCreate(ComplaintBase):
    pass

class ComplaintOut(ComplaintBase):
    id: int

    class Config:
        from_attributes = True
