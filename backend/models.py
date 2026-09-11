from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from .database import Base

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    
    # 1. Origin & Customer Details
    complaint_source = Column(String, default="Not Provided")
    customer_name = Column(String, default="Not Provided")
    
    # 2. Product & Batch Identification
    product_name = Column(String, default="Not Provided")
    product_strength_grade = Column(String, default="Not Provided")
    batch_lot_number = Column(String, default="Not Provided")
    affected_quantity = Column(String, default="Not Provided")
    manufacturing_date = Column(String, default="Not Provided")
    expiry_date = Column(String, default="Not Provided")
    
    # 3. Facility & Material Impact
    originating_site_block = Column(String, default="Not Provided")
    impacted_non_product_materials = Column(String, default="Not Provided")
    
    # 4. Defect Analysis
    complaint_category = Column(String, default="Not Provided")
    complaint_description = Column(Text, default="Not Provided")
    ai_severity = Column(String, default="Not Provided")
    ai_suggested_next_action = Column(String, default="Not Provided")
    ai_initial_risk_assessment = Column(Text, default="Not Provided")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
