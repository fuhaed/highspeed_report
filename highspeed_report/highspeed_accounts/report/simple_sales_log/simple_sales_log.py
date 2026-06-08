# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import datetime

def execute(filters=None):
    """Main execution function for the simplified sales report"""
    if not filters:
        filters = {}
    
    # Set default date range if not provided
    if not filters.get("from_date"):
        filters["from_date"] = datetime.date.today().replace(day=1)
    
    if not filters.get("to_date"):
        filters["to_date"] = datetime.date.today()
    
    # Set default time range if not provided
    if not filters.get("from_time"):
        filters["from_time"] = "00:00:00"
    
    if not filters.get("to_time"):
        filters["to_time"] = "23:59:59"
    
    # Get report data
    columns = get_columns()
    data = get_sales_data(filters)
    
    return columns, data

def get_columns():
    """Define the columns for the simplified report"""
    return [
        {
            "fieldname": "posting_date",
            "label": _("التاريخ"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "posting_time",
            "label": _("الوقت"),
            "fieldtype": "Time",
            "width": 80
        },
        {
            "fieldname": "voucher_type",
            "label": _("نوع المستند"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "voucher_no",
            "label": _("رقم المستند"),
            "fieldtype": "Link",
            "options": "Sales Invoice",
            "width": 140
        },
        {
            "fieldname": "customer_name",
            "label": _("Customer"),
            "fieldtype": "Data",
            "width": 180
        },
        {
            "fieldname": "invoice_status",
            "label": _("حالة الفاتورة"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "grand_total",
            "label": _("Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "owner",
            "label": _("المستخدم"),
            "fieldtype": "Data",
            "width": 120
        }
    ]

def get_sales_data(filters):
    """Get sales data based on filters and user permissions"""
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date")
    }
    
    conditions.append("si.company = %(company)s")
    conditions.append("si.posting_date BETWEEN %(from_date)s AND %(to_date)s")
    
    # Filter explicitly by docstatus to ensure only submitted invoices are shown
    conditions.append("si.docstatus = 1")
    
    # Add time filter conditions
    if filters.get("from_time") and filters.get("to_time"):
        conditions.append("""
            CONCAT(si.posting_date, ' ', si.posting_time) BETWEEN 
            CONCAT(%(from_date)s, ' ', %(from_time)s) AND 
            CONCAT(%(to_date)s, ' ', %(to_time)s)
        """)
        values["from_time"] = filters.get("from_time")
        values["to_time"] = filters.get("to_time")
    
    # Filter by customer if provided
    if filters.get("customer"):
        conditions.append("si.customer = %(customer)s")
        values["customer"] = filters.get("customer")
    
    # Filter by invoice status (if provided)
    if filters.get("status") and filters.get("status") not in ['Draft', 'Cancelled']:
        conditions.append("si.status = %(status)s")
        values["status"] = filters.get("status")
    
    # Filter by invoice type if provided
    if filters.get("invoice_type"):
        if filters.get("invoice_type") == "Sales":
            conditions.append("si.is_return = 0")
        elif filters.get("invoice_type") == "Return":
            conditions.append("si.is_return = 1")
    
    # Apply permissions - Only show invoices the user has access to
    user = frappe.session.user
    
    # Get user roles the safer way
    user_roles = frappe.get_roles(user)
    
    # If not Administrator, System Manager, or Accounts Manager, apply user-specific filters
    if "Administrator" not in user_roles and "System Manager" not in user_roles and "Accounts Manager" not in user_roles:
        # Sales managers can see all sales invoices
        if "Sales Manager" not in user_roles:
            # Sales Users/Sales Reps can only see invoices they created
            if "Sales User" in user_roles:
                conditions.append("si.owner = %(current_user)s")
                values["current_user"] = user
            
            # If configured, also filter by sales person territory
            try:
                sales_person = frappe.db.get_value("Sales Person", {"user": user}, "name")
                if sales_person:
                    territories = frappe.db.sql("""
                        SELECT territory 
                        FROM `tabSales Person Territory` 
                        WHERE parent = %s
                    """, (sales_person,), as_dict=1)
                
                    if territories:
                        territory_list = [t.territory for t in territories]
                        territory_conditions = []
                        
                        for i, territory in enumerate(territory_list):
                            territory_param = f"territory_{i}"
                            territory_conditions.append(f"si.territory = %({territory_param})s")
                            values[territory_param] = territory
                        
                        if territory_conditions:
                            conditions.append(f"({' OR '.join(territory_conditions)})")
            except Exception as e:
                frappe.log_error(f"Error in territory filtering: {str(e)}", "Simple Sales Log")
    
    # Query to get sales invoice data
    sales_data = frappe.db.sql("""
        SELECT
            si.posting_date,
            si.posting_time,
            'Sales Invoice' as voucher_type,
            si.name as voucher_no,
            si.customer_name,
            si.status,
            si.is_return,
            si.grand_total,
            si.owner
        FROM
            `tabSales Invoice` si
        WHERE
            {conditions}
        ORDER BY
            si.posting_date DESC, si.posting_time DESC, si.name
    """.format(
        conditions=" AND ".join(conditions)
    ), values, as_dict=1)
    
    # Process and augment data
    data = []
    for row in sales_data:
        # Get invoice status in Arabic
        invoice_status = get_arabic_status(row.status, row.is_return)
        
        # Get user's full name
        user_fullname = frappe.db.get_value("User", row.owner, "full_name") if row.owner else ""
        
        # Format the voucher type in Arabic
        voucher_type = _("Sales Invoice") if not row.is_return else _("مرتجع مبيعات")
        
        # Replace null values with empty values or default texts
        posting_date = row.posting_date or ""
        posting_time = row.posting_time or ""
        voucher_no = row.voucher_no or ""
        customer_name = row.customer_name or _("غير محدد")
        grand_total = float(row.grand_total or 0)
        owner = user_fullname or row.owner or _("غير محدد")
        
        # Add the sales entry to the data
        data.append({
            "posting_date": posting_date,
            "posting_time": posting_time,
            "voucher_type": voucher_type,
            "voucher_no": voucher_no,
            "customer_name": customer_name,
            "invoice_status": invoice_status,
            "grand_total": grand_total,
            "owner": owner
        })
    
    return data

def get_arabic_status(status, is_return=0):
    """Convert invoice status to Arabic"""
    if is_return:
        return _("مرتجع مبيعات")
    
    status_map = {
        "Draft": _("مسودة"),
        "Submitted": _("مقدمة"),
        "Paid": _("مسددة بالكامل"),
        "Unpaid": _("غير مسددة"),
        "Partly Paid": _("مسددة جزئياً"),
        "Overdue": _("متأخرة السداد"),
        "Cancelled": _("ملغية"),
        "Credit Note Issued": _("إشعار دائن مصدر")
    }
    
    return status_map.get(status, status)