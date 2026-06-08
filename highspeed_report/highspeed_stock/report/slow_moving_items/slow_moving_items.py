# Copyright (c) 2023, Me and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import add_days, getdate, today, date_diff, flt, add_months, add_years, get_datetime
import datetime

def execute(filters=None):
    if not filters:
        filters = {"company": frappe.defaults.get_user_default("Company")}
    
    # الفلاتر الافتراضية
    if not filters.get("date_range"):
        filters["date_range"] = "1_year"
    
    if not filters.get("from_date"):
        # حساب تاريخ البداية استناداً إلى نطاق المدة المختارة
        if filters.get("date_range") == "6_months":
            filters["from_date"] = add_months(today(), -6)
        elif filters.get("date_range") == "1_year":
            filters["from_date"] = add_years(today(), -1)
        elif filters.get("date_range") == "2_years":
            filters["from_date"] = add_years(today(), -2)
        elif filters.get("date_range") == "3_years":
            filters["from_date"] = add_years(today(), -3)
        else:
            filters["from_date"] = add_years(today(), -1)  # افتراضي سنة واحدة
    
    if not filters.get("to_date"):
        filters["to_date"] = today()
    
    # تعريف أعمدة التقرير
    columns = [
        {"label": _("Item Code"), "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 140},
        {"label": _("Item Name"), "fieldname": "item_name", "width": 250},
        {"label": _("Item Group"), "fieldname": "item_group", "fieldtype": "Link", "options": "Item Group", "width": 120},
        {"label": _("UOM"), "fieldname": "stock_uom", "fieldtype": "Link", "options": "UOM", "width": 90},
        {"label": _("Available Qty"), "fieldname": "available_qty", "fieldtype": "Float", "width": 100},
        {"label": _("Stock Value"), "fieldname": "stock_value", "fieldtype": "Currency", "width": 110},
        {"label": _("Last Sale Date"), "fieldname": "last_sale_date", "fieldtype": "Date", "width": 120},
        {"label": _("Days Since Last Sale"), "fieldname": "days_since_last_sale", "fieldtype": "Int", "width": 130},
        {"label": _("Last Purchase Date"), "fieldname": "last_purchase_date", "fieldtype": "Date", "width": 130},
        {"label": _("Days Since Last Purchase"), "fieldname": "days_since_last_purchase", "fieldtype": "Int", "width": 130},
        {"label": _("Last Stock Date"), "fieldname": "last_stock_date", "fieldtype": "Date", "width": 130},
        {"label": _("Warehouse"), "fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse", "width": 150}
    ]

    try:
        data = get_data(filters)
        frappe.msgprint(_("Retrieved {} slow-moving items").format(len(data)))
    except Exception as e:
        frappe.msgprint(_("An error occurred: {}").format(str(e)))
        data = []
    
    return columns, data

def get_data(filters):
    # الحصول على الأصناف المتاحة في المخزون
    items_with_stock = get_items_with_stock()
    
    if not items_with_stock:
        return []
    
    # تجميع جميع الأصناف المميزة
    all_items = {}
    for item in items_with_stock:
        if item.item_code not in all_items:
            all_items[item.item_code] = {
                "item_code": item.item_code,
                "item_name": item.item_name,
                "item_group": item.item_group,
                "stock_uom": item.stock_uom,
                "warehouses": []
            }
        # إضافة معلومات المستودع
        all_items[item.item_code]["warehouses"].append({
            "warehouse": item.warehouse,
            "actual_qty": item.actual_qty,
            "stock_value": item.stock_value
        })
    
    # الحصول على آخر حركات البيع والشراء والمخزون لكل صنف
    item_codes = list(all_items.keys())
    
    # البحث في جميع حركات البيع (فواتير المبيعات، سندات التسليم، أوامر المبيعات)
    sales_data = get_last_sales_activities(item_codes, filters.get("company"))
    
    # البحث في جميع حركات الشراء (فواتير المشتريات، سندات الاستلام، أوامر الشراء)
    purchase_data = get_last_purchase_activities(item_codes, filters.get("company"))
    
    # البحث في حركات المخزون
    stock_data = get_last_stock_activities(item_codes, filters.get("company"))
    
    # تحليل وفلترة البيانات
    result = []
    today_date = getdate(today())
    from_date = getdate(filters.get("from_date"))
    
    for item_code, item_info in all_items.items():
        # فلترة حسب المجموعة
        if filters.get("item_group") and item_info["item_group"] != filters.get("item_group"):
            continue
            
        # فلترة حسب كود الصنف
        if filters.get("item_code") and item_code != filters.get("item_code"):
            continue
        
        # فلترة حسب المستودع
        if filters.get("warehouse"):
            warehouses = [w for w in item_info["warehouses"] if w["warehouse"] == filters.get("warehouse")]
            if not warehouses:
                continue
            item_info["warehouses"] = warehouses
        
        # فلترة حسب الشركة
        if filters.get("company"):
            company_warehouses = get_company_warehouses(filters.get("company"))
            warehouses = [w for w in item_info["warehouses"] if w["warehouse"] in company_warehouses]
            if not warehouses:
                continue
            item_info["warehouses"] = warehouses
        
        # حساب إجمالي المخزون
        total_qty = sum(w["actual_qty"] for w in item_info["warehouses"])
        total_value = sum(w["stock_value"] for w in item_info["warehouses"])
        
        # الحصول على معلومات آخر حركات
        last_sale_date = sales_data.get(item_code)
        last_purchase_date = purchase_data.get(item_code)
        last_stock_date = stock_data.get(item_code)
        
        # حساب الأيام منذ آخر حركة
        days_since_last_sale = date_diff(today_date, getdate(last_sale_date)) if last_sale_date else 0
        days_since_last_purchase = date_diff(today_date, getdate(last_purchase_date)) if last_purchase_date else 0
        
        # تحديد ما إذا كان الصنف راكداً
        is_slow_moving = True
        
        # إذا كان هناك مبيعات حديثة (بعد التاريخ المحدد)، فالصنف ليس راكداً
        if last_sale_date and getdate(last_sale_date) > from_date:
            is_slow_moving = False
        
        # إضافة الصنف إلى النتائج إذا كان راكداً
        if is_slow_moving:
            # إضافة صف لكل مستودع للصنف
            for warehouse_info in item_info["warehouses"]:
                result.append({
                    "item_code": item_code,
                    "item_name": item_info["item_name"],
                    "item_group": item_info["item_group"],
                    "stock_uom": item_info["stock_uom"],
                    "available_qty": warehouse_info["actual_qty"],
                    "stock_value": warehouse_info["stock_value"],
                    "last_sale_date": last_sale_date,
                    "days_since_last_sale": days_since_last_sale,
                    "last_purchase_date": last_purchase_date,
                    "days_since_last_purchase": days_since_last_purchase,
                    "last_stock_date": last_stock_date,
                    "warehouse": warehouse_info["warehouse"]
                })
    
    # ترتيب النتائج
    result.sort(key=lambda x: (
        # الأصناف التي لم تباع أبداً أولاً
        x.get("last_sale_date") is not None,
        # ثم حسب عدد الأيام منذ آخر بيع (تنازلياً)
        -1 * (x.get("days_since_last_sale") or 0),
        # ثم حسب كود الصنف
        x.get("item_code")
    ))
    
    return result

def get_items_with_stock():
    """الحصول على جميع الأصناف المتاحة في المخزون"""
    try:
        # استعلام للحصول على الأصناف مع المخزون
        query = """
            SELECT 
                b.item_code,
                i.item_name,
                i.item_group,
                i.stock_uom,
                b.warehouse,
                b.actual_qty,
                b.stock_value
            FROM 
                `tabBin` b
            JOIN 
                `tabItem` i ON b.item_code = i.name
            WHERE 
                b.actual_qty > 0
                AND i.disabled = 0
        """
        return frappe.db.sql(query, as_dict=1)
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام المخزون: {str(e)}")
        return []

def get_company_warehouses(company):
    """الحصول على قائمة المستودعات التابعة للشركة"""
    try:
        warehouses = frappe.get_all("Warehouse", filters={"company": company}, fields=["name"])
        return [w.name for w in warehouses]
    except Exception as e:
        frappe.log_error(f"خطأ في الحصول على مستودعات الشركة: {str(e)}")
        return []

def get_last_sales_activities(item_codes, company=None):
    """الحصول على آخر تاريخ لأي نشاط بيع للصنف (فواتير المبيعات، سندات التسليم، أوامر المبيعات)"""
    if not item_codes:
        return {}
    
    result = {}
    
    # البحث في فواتير المبيعات
    try:
        last_invoice_dates = get_last_sales_invoice_dates(item_codes, company)
        result.update(last_invoice_dates)
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام فواتير المبيعات: {str(e)}")
    
    # البحث في سندات التسليم
    try:
        last_delivery_dates = get_last_delivery_note_dates(item_codes, company)
        
        # دمج التواريخ مع اختيار الأحدث
        for item_code, date in last_delivery_dates.items():
            if item_code not in result or (date and (not result[item_code] or date > result[item_code])):
                result[item_code] = date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام سندات التسليم: {str(e)}")
    
    # البحث في أوامر المبيعات
    try:
        last_so_dates = get_last_sales_order_dates(item_codes, company)
        
        # دمج التواريخ مع اختيار الأحدث
        for item_code, date in last_so_dates.items():
            if item_code not in result or (date and (not result[item_code] or date > result[item_code])):
                result[item_code] = date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام أوامر المبيعات: {str(e)}")
    
    return result

def get_last_sales_invoice_dates(item_codes, company=None):
    """الحصول على آخر تاريخ فاتورة مبيعات لكل صنف"""
    result = {}
    try:
        conditions = ["sii.item_code IN %(items)s", "si.docstatus = 1"]
        params = {"items": item_codes}
        
        if company:
            conditions.append("si.company = %(company)s")
            params["company"] = company
        
        query = """
            SELECT 
                sii.item_code,
                MAX(si.posting_date) as last_date
            FROM 
                `tabSales Invoice Item` sii
            JOIN 
                `tabSales Invoice` si ON sii.parent = si.name
            WHERE 
                {0}
            GROUP BY 
                sii.item_code
        """.format(" AND ".join(conditions))
        
        sales_data = frappe.db.sql(query, params, as_dict=1)
        
        for row in sales_data:
            if row.item_code and row.last_date:
                result[row.item_code] = row.last_date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام فواتير المبيعات: {str(e)}")
    
    return result

def get_last_delivery_note_dates(item_codes, company=None):
    """الحصول على آخر تاريخ سند تسليم لكل صنف"""
    result = {}
    try:
        conditions = ["dni.item_code IN %(items)s", "dn.docstatus = 1"]
        params = {"items": item_codes}
        
        if company:
            conditions.append("dn.company = %(company)s")
            params["company"] = company
        
        query = """
            SELECT 
                dni.item_code,
                MAX(dn.posting_date) as last_date
            FROM 
                `tabDelivery Note Item` dni
            JOIN 
                `tabDelivery Note` dn ON dni.parent = dn.name
            WHERE 
                {0}
            GROUP BY 
                dni.item_code
        """.format(" AND ".join(conditions))
        
        delivery_data = frappe.db.sql(query, params, as_dict=1)
        
        for row in delivery_data:
            if row.item_code and row.last_date:
                result[row.item_code] = row.last_date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام سندات التسليم: {str(e)}")
    
    return result

def get_last_sales_order_dates(item_codes, company=None):
    """الحصول على آخر تاريخ أمر مبيعات لكل صنف"""
    result = {}
    try:
        conditions = ["soi.item_code IN %(items)s", "so.docstatus = 1"]
        params = {"items": item_codes}
        
        if company:
            conditions.append("so.company = %(company)s")
            params["company"] = company
        
        query = """
            SELECT 
                soi.item_code,
                MAX(so.transaction_date) as last_date
            FROM 
                `tabSales Order Item` soi
            JOIN 
                `tabSales Order` so ON soi.parent = so.name
            WHERE 
                {0}
            GROUP BY 
                soi.item_code
        """.format(" AND ".join(conditions))
        
        so_data = frappe.db.sql(query, params, as_dict=1)
        
        for row in so_data:
            if row.item_code and row.last_date:
                result[row.item_code] = row.last_date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام أوامر المبيعات: {str(e)}")
    
    return result

def get_last_purchase_activities(item_codes, company=None):
    """الحصول على آخر تاريخ لأي نشاط شراء للصنف (فواتير الشراء، سندات الاستلام، أوامر الشراء)"""
    if not item_codes:
        return {}
    
    result = {}
    
    # البحث في فواتير الشراء
    try:
        last_invoice_dates = get_last_purchase_invoice_dates(item_codes, company)
        result.update(last_invoice_dates)
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام فواتير الشراء: {str(e)}")
    
    # البحث في سندات الاستلام
    try:
        last_receipt_dates = get_last_purchase_receipt_dates(item_codes, company)
        
        # دمج التواريخ مع اختيار الأحدث
        for item_code, date in last_receipt_dates.items():
            if item_code not in result or (date and (not result[item_code] or date > result[item_code])):
                result[item_code] = date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام سندات الاستلام: {str(e)}")
    
    # البحث في أوامر الشراء
    try:
        last_po_dates = get_last_purchase_order_dates(item_codes, company)
        
        # دمج التواريخ مع اختيار الأحدث
        for item_code, date in last_po_dates.items():
            if item_code not in result or (date and (not result[item_code] or date > result[item_code])):
                result[item_code] = date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام أوامر الشراء: {str(e)}")
    
    return result

def get_last_purchase_invoice_dates(item_codes, company=None):
    """الحصول على آخر تاريخ فاتورة شراء لكل صنف"""
    result = {}
    try:
        conditions = ["pii.item_code IN %(items)s", "pi.docstatus = 1"]
        params = {"items": item_codes}
        
        if company:
            conditions.append("pi.company = %(company)s")
            params["company"] = company
        
        query = """
            SELECT 
                pii.item_code,
                MAX(pi.posting_date) as last_date
            FROM 
                `tabPurchase Invoice Item` pii
            JOIN 
                `tabPurchase Invoice` pi ON pii.parent = pi.name
            WHERE 
                {0}
            GROUP BY 
                pii.item_code
        """.format(" AND ".join(conditions))
        
        purchase_data = frappe.db.sql(query, params, as_dict=1)
        
        for row in purchase_data:
            if row.item_code and row.last_date:
                result[row.item_code] = row.last_date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام فواتير الشراء: {str(e)}")
    
    return result

def get_last_purchase_receipt_dates(item_codes, company=None):
    """الحصول على آخر تاريخ سند استلام لكل صنف"""
    result = {}
    try:
        conditions = ["pri.item_code IN %(items)s", "pr.docstatus = 1"]
        params = {"items": item_codes}
        
        if company:
            conditions.append("pr.company = %(company)s")
            params["company"] = company
        
        query = """
            SELECT 
                pri.item_code,
                MAX(pr.posting_date) as last_date
            FROM 
                `tabPurchase Receipt Item` pri
            JOIN 
                `tabPurchase Receipt` pr ON pri.parent = pr.name
            WHERE 
                {0}
            GROUP BY 
                pri.item_code
        """.format(" AND ".join(conditions))
        
        receipt_data = frappe.db.sql(query, params, as_dict=1)
        
        for row in receipt_data:
            if row.item_code and row.last_date:
                result[row.item_code] = row.last_date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام سندات الاستلام: {str(e)}")
    
    return result

def get_last_purchase_order_dates(item_codes, company=None):
    """الحصول على آخر تاريخ أمر شراء لكل صنف"""
    result = {}
    try:
        conditions = ["poi.item_code IN %(items)s", "po.docstatus = 1"]
        params = {"items": item_codes}
        
        if company:
            conditions.append("po.company = %(company)s")
            params["company"] = company
        
        query = """
            SELECT 
                poi.item_code,
                MAX(po.transaction_date) as last_date
            FROM 
                `tabPurchase Order Item` poi
            JOIN 
                `tabPurchase Order` po ON poi.parent = po.name
            WHERE 
                {0}
            GROUP BY 
                poi.item_code
        """.format(" AND ".join(conditions))
        
        po_data = frappe.db.sql(query, params, as_dict=1)
        
        for row in po_data:
            if row.item_code and row.last_date:
                result[row.item_code] = row.last_date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام أوامر الشراء: {str(e)}")
    
    return result

def get_last_stock_activities(item_codes, company=None):
    """الحصول على آخر تاريخ حركة مخزون لكل صنف (سندات المخزون)"""
    if not item_codes:
        return {}
    
    result = {}
    try:
        conditions = ["sle.item_code IN %(items)s"]
        params = {"items": item_codes}
        
        if company:
            conditions.append("sle.company = %(company)s")
            params["company"] = company
        
        query = """
            SELECT 
                sle.item_code,
                MAX(sle.posting_date) as last_date
            FROM 
                `tabStock Ledger Entry` sle
            WHERE 
                {0}
            GROUP BY 
                sle.item_code
        """.format(" AND ".join(conditions))
        
        stock_data = frappe.db.sql(query, params, as_dict=1)
        
        for row in stock_data:
            if row.item_code and row.last_date:
                result[row.item_code] = row.last_date
    except Exception as e:
        frappe.log_error(f"خطأ في استعلام حركات المخزون: {str(e)}")
    
    return result
