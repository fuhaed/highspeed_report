# Copyright (c) 2026, Highspeed and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate

def execute(filters=None):
    if not filters:
        filters = {}

    columns = get_columns()
    data = get_data(filters)
    summary = get_report_summary(data)

    return columns, data, None, None, summary

def get_columns():
    return [
        {
            "label": _("Posting Date"),
            "fieldname": "posting_date",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": _("Cashier / User"),
            "fieldname": "user",
            "fieldtype": "Link",
            "options": "User",
            "width": 160
        },
        {
            "label": _("Mode of Payment"),
            "fieldname": "mode_of_payment",
            "fieldtype": "Link",
            "options": "Mode of Payment",
            "width": 150
        },
        {
            "label": _("Expected Amount"),
            "fieldname": "expected_amount",
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "label": _("Received Amount"),
            "fieldname": "received_amount",
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "label": _("Difference"),
            "fieldname": "difference",
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 120
        }
    ]

def get_data(filters):
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    company = filters.get("company")

    # 1. Fetch standard POS Closing Entry payment details
    pce_conditions = ["pce.docstatus = 1", "pce.posting_date BETWEEN %(from_date)s AND %(to_date)s"]
    pce_values = {"from_date": from_date, "to_date": to_date}
    if company:
        pce_conditions.append("pce.company = %(company)s")
        pce_values["company"] = company

    pce_query = f"""
        SELECT 
            pce.posting_date,
            pce.user,
            pced.mode_of_payment,
            SUM(pced.expected_amount) as expected,
            SUM(pced.closing_amount) as closing,
            SUM(pced.difference) as difference
        FROM 
            `tabPOS Closing Entry Detail` pced
        INNER JOIN 
            `tabPOS Closing Entry` pce ON pced.parent = pce.name
        WHERE 
            {" AND ".join(pce_conditions)}
        GROUP BY 
            pce.posting_date, pce.user, pced.mode_of_payment
    """
    pce_reconciled = []
    if frappe.db.exists("DocType", "POS Closing Entry"):
        try:
            pce_reconciled = frappe.db.sql(pce_query, pce_values, as_dict=True)
        except Exception:
            pass

    # 2. Fetch custom POS shifts if they exist
    custom_reconciled = []
    doctype_closing = None
    doctype_closing_detail = None
    if frappe.db.exists("DocType", "POS Closing Shift"):
        doctype_closing = "POS Closing Shift"
        doctype_closing_detail = "POS Closing Shift Detail"
    elif frappe.db.exists("DocType", "HSPOS Closing Shift"):
        doctype_closing = "HSPOS Closing Shift"
        doctype_closing_detail = "HSPOS Closing Shift Detail"

    if doctype_closing:
        pcs_conditions = ["pcs.docstatus = 1", "pcs.period_end_date BETWEEN %(from_date)s AND %(to_date)s"]
        pcs_values = {"from_date": from_date, "to_date": to_date}
        if company:
            pcs_conditions.append("pcs.company = %(company)s")
            pcs_values["company"] = company

        pcs_query = f"""
            SELECT 
                DATE(pcs.period_end_date) as posting_date,
                pcs.user,
                pcsd.mode_of_payment,
                SUM(pcsd.expected_amount) as expected,
                SUM(pcsd.closing_amount) as closing,
                SUM(pcsd.difference) as difference
            FROM 
                `tab{doctype_closing_detail}` pcsd
            INNER JOIN 
                `tab{doctype_closing}` pcs ON pcsd.parent = pcs.name
            WHERE 
                {" AND ".join(pcs_conditions)}
            GROUP BY 
                DATE(pcs.period_end_date), pcs.user, pcsd.mode_of_payment
        """
        try:
            custom_reconciled = frappe.db.sql(pcs_query, pcs_values, as_dict=True)
        except Exception:
            pass

    # Map reconciled sessions to dictionary
    reconciled_map = {}
    
    def add_to_map(records, status_label):
        for r in records:
            key = (getdate(r.posting_date), r.user, r.mode_of_payment)
            if key not in reconciled_map:
                reconciled_map[key] = {
                    "expected": flt(r.expected),
                    "closing": flt(r.closing),
                    "difference": flt(r.difference),
                    "status": status_label
                }
            else:
                reconciled_map[key]["expected"] += flt(r.expected)
                reconciled_map[key]["closing"] += flt(r.closing)
                reconciled_map[key]["difference"] += flt(r.difference)

    add_to_map(pce_reconciled, _("POS Session Closed"))
    add_to_map(custom_reconciled, _("Custom Shift Closed"))

    # 3. Query all Sales Invoice Payments to capture everything
    inv_conditions = ["si.docstatus = 1", "si.posting_date BETWEEN %(from_date)s AND %(to_date)s"]
    inv_values = {"from_date": from_date, "to_date": to_date}
    if company:
        inv_conditions.append("si.company = %(company)s")
        inv_values["company"] = company

    inv_query = f"""
        SELECT 
            si.posting_date,
            si.owner as user,
            sip.mode_of_payment,
            SUM(sip.amount) as amount
        FROM 
            `tabSales Invoice Payment` sip
        INNER JOIN 
            `tabSales Invoice` si ON sip.parent = si.name
        WHERE 
            { " AND ".join(inv_conditions) }
        GROUP BY 
            si.posting_date, si.owner, sip.mode_of_payment
    """
    all_payments = frappe.db.sql(inv_query, inv_values, as_dict=True)

    data = []
    processed_keys = set()

    for p in all_payments:
        key = (getdate(p.posting_date), p.user, p.mode_of_payment)
        processed_keys.add(key)
        
        # Check if reconciled via POS Closing or custom Shift
        rec = reconciled_map.get(key)
        
        if rec:
            data.append({
                "posting_date": p.posting_date,
                "user": p.user,
                "mode_of_payment": p.mode_of_payment,
                "expected_amount": rec["expected"],
                "received_amount": rec["closing"],
                "difference": rec["difference"],
                "status": rec["status"]
            })
        else:
            # Not reconciled / standard invoice
            data.append({
                "posting_date": p.posting_date,
                "user": p.user,
                "mode_of_payment": p.mode_of_payment,
                "expected_amount": flt(p.amount),
                "received_amount": flt(p.amount),
                "difference": 0.0,
                "status": _("Direct Invoice Payment")
            })

    # Add any reconciled entries that were not queried in Sales Invoice Payments
    for key, rec in reconciled_map.items():
        if key not in processed_keys:
            data.append({
                "posting_date": key[0],
                "user": key[1],
                "mode_of_payment": key[2],
                "expected_amount": rec["expected"],
                "received_amount": rec["closing"],
                "difference": rec["difference"],
                "status": rec["status"]
            })

    # Sort by date and user
    data.sort(key=lambda x: (x["posting_date"], x["user"]), reverse=True)
    return data

def get_report_summary(data):
    total_expected = sum(row["expected_amount"] for row in data)
    total_received = sum(row["received_amount"] for row in data)
    total_diff = sum(row["difference"] for row in data)

    indicator = "green"
    if total_diff < 0:
        indicator = "red"
    elif total_diff > 0:
        indicator = "orange"

    return [
        {
            "value": total_expected,
            "label": _("Total Expected"),
            "indicator": "blue",
            "datatype": "Currency"
        },
        {
            "value": total_received,
            "label": _("Total Received"),
            "indicator": "green",
            "datatype": "Currency"
        },
        {
            "value": total_diff,
            "label": _("Total Difference"),
            "indicator": indicator,
            "datatype": "Currency"
        }
    ]
