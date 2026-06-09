# Copyright (c) 2026, Highspeed and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate

def execute(filters=None):
    if not filters:
        filters = {}

    if not filters.get("account"):
        # Return empty data if account is not selected
        return get_columns(), [], None, None, []

    columns = get_columns()
    data = get_data(filters)
    summary = get_report_summary(data, filters)

    return columns, data, None, None, summary

def get_columns():
    return [
        {
            "label": _("Date"),
            "fieldname": "posting_date",
            "fieldtype": "Date",
            "width": 110
        },
        {
            "label": _("Voucher Type"),
            "fieldname": "voucher_type",
            "fieldtype": "Data",
            "width": 130
        },
        {
            "label": _("Voucher No"),
            "fieldname": "voucher_no",
            "fieldtype": "Dynamic Link",
            "options": "voucher_type",
            "width": 160
        },
        {
            "label": _("Particulars"),
            "fieldname": "remarks",
            "fieldtype": "Data",
            "width": 260
        },
        {
            "label": _("Debit (In)"),
            "fieldname": "debit",
            "fieldtype": "Currency",
            "width": 130
        },
        {
            "label": _("Credit (Out)"),
            "fieldname": "credit",
            "fieldtype": "Currency",
            "width": 130
        },
        {
            "label": _("Balance"),
            "fieldname": "balance",
            "fieldtype": "Currency",
            "width": 140
        }
    ]

def get_data(filters):
    account = filters.get("account")
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    company = filters.get("company")

    # 1. Calculate Opening Balance
    op_conditions = ["account = %(account)s", "posting_date < %(from_date)s", "is_cancelled = 0"]
    op_values = {"account": account, "from_date": from_date}
    if company:
        op_conditions.append("company = %(company)s")
        op_values["company"] = company

    opening_query = f"""
        SELECT SUM(debit - credit) as balance
        FROM `tabGL Entry`
        WHERE {" AND ".join(op_conditions)}
    """
    opening_balance = flt(frappe.db.sql(opening_query, op_values)[0][0])

    # 2. Query GL Entries for range
    gl_conditions = ["account = %(account)s", "posting_date BETWEEN %(from_date)s AND %(to_date)s", "is_cancelled = 0"]
    gl_values = {"account": account, "from_date": from_date, "to_date": to_date}
    if company:
        gl_conditions.append("company = %(company)s")
        gl_values["company"] = company

    gl_query = f"""
        SELECT 
            posting_date,
            voucher_type,
            voucher_no,
            remarks,
            debit,
            credit
        FROM 
            `tabGL Entry`
        WHERE 
            {" AND ".join(gl_conditions)}
        ORDER BY 
            posting_date ASC, creation ASC
    """
    entries = frappe.db.sql(gl_query, gl_values, as_dict=True)

    data = []
    
    # Add opening balance row
    data.append({
        "posting_date": from_date,
        "voucher_type": "",
        "voucher_no": "",
        "remarks": f"--- { _('Opening Balance') } ---",
        "debit": 0.0,
        "credit": 0.0,
        "balance": opening_balance
    })

    running_balance = opening_balance
    for e in entries:
        debit = flt(e.debit)
        credit = flt(e.credit)
        running_balance += debit - credit
        
        data.append({
            "posting_date": e.posting_date,
            "voucher_type": e.voucher_type,
            "voucher_no": e.voucher_no,
            "remarks": e.remarks,
            "debit": debit,
            "credit": credit,
            "balance": running_balance
        })

    return data

def get_report_summary(data, filters):
    if not data:
        return []
        
    opening_balance = data[0]["balance"]
    closing_balance = data[-1]["balance"]
    
    total_debit = sum(row["debit"] for row in data)
    total_credit = sum(row["credit"] for row in data)

    return [
        {
            "value": opening_balance,
            "label": _("Opening Balance"),
            "indicator": "blue",
            "datatype": "Currency"
        },
        {
            "value": total_debit,
            "label": _("Total Inflow (Debit)"),
            "indicator": "green",
            "datatype": "Currency"
        },
        {
            "value": total_credit,
            "label": _("Total Outflow (Credit)"),
            "indicator": "red",
            "datatype": "Currency"
        },
        {
            "value": closing_balance,
            "label": _("Closing Balance"),
            "indicator": "orange",
            "datatype": "Currency"
        }
    ]
