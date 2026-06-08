import frappe
from frappe import _
from frappe.utils import flt, getdate, formatdate, nowdate

def execute(filters=None):
    validate_filters(filters)
    columns = get_columns()
    data = get_data(filters)
    message = get_message(data, filters)
    return columns, data, message

def validate_filters(filters):
    if not filters:
        filters = {}
    
    if not filters.get("date"):
        filters["date"] = nowdate()
    
    return filters

def get_message(data, filters):
    data_without_totals = [row for row in data if not row.get("_bold")]
    
    total_items = len(data_without_totals)
    items_with_difference = sum(1 for row in data_without_totals if abs(row.get("difference", 0)) > 0.01)
    negative_stock_items = sum(1 for row in data_without_totals if row.get("available_qty", 0) < 0)
    
    message = []
    
    date_str = formatdate(filters.get("date"), "dd/MM/yyyy")
    from_time = filters.get("from_time", "00:00:00")
    to_time = filters.get("to_time", "23:59:59")
    
    if from_time != "00:00:00" or to_time != "23:59:59":
        message.append(f"<span style='color:#2c3e50'><b>الفترة:</b> {date_str} من الساعة {from_time} إلى {to_time}</span>")
    
    if items_with_difference > 0:
        message.append(f"<span style='color:orange'><b>تنبيه:</b> يوجد {items_with_difference} صنف من أصل {total_items} لديه فروقات في المخزون</span>")
    
    if negative_stock_items > 0:
        message.append(f"<span style='color:red'><b>تحذير:</b> يوجد {negative_stock_items} صنف بمخزون سالب</span>")
    
    if getdate(filters.get("date")) == getdate() and to_time == "23:59:59":
        message.append("<span style='color:blue'>ملاحظة: هذا التقرير لليوم الحالي وقد تتغير الأرقام مع حركات جديدة</span>")
    
    return "<br>".join(message) if message else None

def get_columns():
    return [
        {
            "fieldname": "item_code",
            "label": _("Item Code"),
            "fieldtype": "Data",
            "width": 130
        },
        {
            "fieldname": "item_name",
            "label": _("Item Name"),
            "fieldtype": "Data",
            "width": 180
        },
        {
            "fieldname": "warehouse",
            "label": _("المخزن"),
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": 130
        },
        {
            "fieldname": "opening_balance",
            "label": _("رصيد أول اليوم"),
            "fieldtype": "Float",
            "width": 110,
            "precision": 2
        },
        {
            "fieldname": "purchases_qty",
            "label": _("المشتريات"),
            "fieldtype": "Float",
            "width": 90,
            "precision": 2
        },
        {
            "fieldname": "purchases_value",
            "label": _("قيمة المشتريات"),
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "fieldname": "sold_qty",
            "label": _("Sales"),
            "fieldtype": "Float",
            "width": 80,
            "precision": 2
        },
        {
            "fieldname": "cogs",
            "label": _("تكلفة المبيعات"),
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "fieldname": "sales_revenue",
            "label": _("إيراد المبيعات"),
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "fieldname": "gross_profit",
            "label": _("الربح الإجمالي"),
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "fieldname": "other_movements",
            "label": _("حركات أخرى"),
            "fieldtype": "Float",
            "width": 90,
            "precision": 2
        },
        {
            "fieldname": "closing_balance",
            "label": _("رصيد آخر اليوم"),
            "fieldtype": "Float",
            "width": 110,
            "precision": 2
        },
        {
            "fieldname": "available_qty",
            "label": _("Current Balance"),
            "fieldtype": "Float",
            "width": 100,
            "precision": 2
        },
        {
            "fieldname": "difference",
            "label": _("الفرق"),
            "fieldtype": "Float",
            "width": 80,
            "precision": 2
        }
    ]

def get_data(filters):
    if not filters:
        filters = {}
    
    date = filters.get("date") or getdate()
    from_time = filters.get("from_time") or "00:00:00"
    to_time = filters.get("to_time") or "23:59:59"
    show_zero_values = filters.get("show_zero_values", 0)
    
    items_warehouses = get_items_warehouses(filters)
    
    data = []
    
    for item_code, warehouse in items_warehouses:
        try:
            item_details = frappe.db.get_value("Item", item_code, 
                ["item_name", "stock_uom"], as_dict=1)
            
            if not item_details:
                continue
            
            opening_balance = get_opening_balance(item_code, warehouse, date, from_time)
            
            daily_movements = get_daily_movements(item_code, warehouse, date, from_time, to_time)
            
            purchases_qty = daily_movements.get("purchases_qty", 0)
            purchases_value = daily_movements.get("purchases_value", 0)
            sold_qty = daily_movements.get("sold_qty", 0)
            cogs = daily_movements.get("cogs", 0)
            sales_revenue = daily_movements.get("sales_revenue", 0)
            other_movements = daily_movements.get("other_movements", 0)
            
            gross_profit = flt(sales_revenue) - flt(cogs)
            
            closing_balance = flt(opening_balance) + flt(purchases_qty) - flt(sold_qty) + flt(other_movements)
            
            bin_data = frappe.db.get_value("Bin", 
                {"item_code": item_code, "warehouse": warehouse}, 
                "actual_qty") or 0
            available_qty = flt(bin_data)
            
            if not bin_data and available_qty == 0:
                available_qty = frappe.db.sql("""
                    SELECT IFNULL(SUM(actual_qty), 0)
                    FROM `tabStock Ledger Entry`
                    WHERE item_code = %s
                    AND warehouse = %s
                    AND docstatus = 1
                """, (item_code, warehouse))[0][0] or 0
            
            if getdate(date) == getdate() and to_time == "23:59:59":
                difference = flt(available_qty) - flt(closing_balance)
            else:
                end_balance = frappe.db.sql("""
                    SELECT IFNULL(SUM(actual_qty), 0)
                    FROM `tabStock Ledger Entry`
                    WHERE item_code = %s
                    AND warehouse = %s
                    AND ((posting_date < %s) 
                        OR (posting_date = %s AND posting_time <= %s))
                    AND docstatus = 1
                """, (item_code, warehouse, date, date, to_time))[0][0] or 0
                
                difference = flt(end_balance) - flt(closing_balance)
                
                if getdate(date) < getdate():
                    available_qty = end_balance
            
            if filters.get("debug"):
                frappe.msgprint(f"""
                    الصنف: {item_code}
                    المخزن: {warehouse}
                    الفترة: {date} من {from_time} إلى {to_time}
                    رصيد أول: {opening_balance}
                    مشتريات: {purchases_qty}
                    مبيعات: {sold_qty}
                    إيراد المبيعات: {sales_revenue}
                    تكلفة المبيعات: {cogs}
                    الربح الإجمالي: {gross_profit}
                    حركات أخرى: {other_movements}
                    رصيد آخر محسوب: {closing_balance}
                    رصيد فعلي: {available_qty}
                    الفرق: {difference}
                """)
            
            has_movement = any([
                abs(purchases_qty) > 0.001,
                abs(sold_qty) > 0.001,
                abs(other_movements) > 0.001
            ])
            
            has_balance = any([
                abs(opening_balance) > 0.001,
                abs(closing_balance) > 0.001,
                abs(available_qty) > 0.001
            ])
            
            movement_type = filters.get("movement_type", "الكل")
            
            should_include = True
            
            if movement_type == "مشتريات فقط":
                should_include = abs(purchases_qty) > 0.001
            elif movement_type == "مبيعات فقط":
                should_include = abs(sold_qty) > 0.001
            elif movement_type == "حركات أخرى فقط":
                should_include = abs(other_movements) > 0.001
            elif movement_type == "أصناف بحركة":
                should_include = has_movement
            elif movement_type == "أصناف بدون حركة":
                should_include = not has_movement and has_balance
            elif movement_type == "أصناف بفروقات":
                should_include = abs(difference) > 0.01
            elif movement_type == "الكل":
                should_include = show_zero_values or has_movement or has_balance
            
            if should_include:
                data.append({
                    "item_code": item_code,
                    "item_name": item_details.item_name,
                    "warehouse": warehouse,
                    "opening_balance": flt(opening_balance, 2),
                    "purchases_qty": flt(purchases_qty, 2),
                    "purchases_value": flt(purchases_value, 2),
                    "sold_qty": flt(sold_qty, 2),
                    "cogs": flt(cogs, 2),
                    "sales_revenue": flt(sales_revenue, 2),
                    "gross_profit": flt(gross_profit, 2),
                    "other_movements": flt(other_movements, 2),
                    "closing_balance": flt(closing_balance, 2),
                    "available_qty": flt(available_qty, 2),
                    "difference": flt(difference, 2),
                    "stock_uom": item_details.get("stock_uom", "")
                })
        
        except Exception as e:
            frappe.log_error(f"Error processing {item_code} in {warehouse}: {str(e)}", 
                           "Daily Inventory Movement Report")
            continue
    
    if data and not filters.get("export"):
        totals = calculate_totals(data)
        data.append(totals)
    
    return data

def calculate_totals(data):
    totals = {
        "item_code": _("<b>الإجمالي</b>"),
        "item_name": "",
        "warehouse": "",
        "opening_balance": sum(row.get("opening_balance", 0) for row in data),
        "purchases_qty": sum(row.get("purchases_qty", 0) for row in data),
        "purchases_value": sum(row.get("purchases_value", 0) for row in data),
        "sold_qty": sum(row.get("sold_qty", 0) for row in data),
        "cogs": sum(row.get("cogs", 0) for row in data),
        "sales_revenue": sum(row.get("sales_revenue", 0) for row in data),
        "gross_profit": sum(row.get("gross_profit", 0) for row in data),
        "other_movements": sum(row.get("other_movements", 0) for row in data),
        "closing_balance": sum(row.get("closing_balance", 0) for row in data),
        "available_qty": sum(row.get("available_qty", 0) for row in data),
        "difference": sum(row.get("difference", 0) for row in data),
        "stock_uom": "",
        "_bold": True,
        "_style": "background-color: #f8f9fa; font-weight: bold;"
    }
    
    for key in ["opening_balance", "purchases_qty", "purchases_value", "sold_qty", 
                "cogs", "sales_revenue", "gross_profit", "other_movements", 
                "closing_balance", "available_qty", "difference"]:
        if isinstance(totals[key], (int, float)):
            totals[key] = flt(totals[key], 2)
    
    return totals

def get_items_warehouses(filters):
    conditions = ""
    values = {}
    
    if filters.get("item_code"):
        conditions += " AND sle.item_code = %(item_code)s"
        values["item_code"] = filters.get("item_code")
    
    if filters.get("warehouse"):
        conditions += " AND sle.warehouse = %(warehouse)s"
        values["warehouse"] = filters.get("warehouse")
    
    if filters.get("item_group"):
        conditions += " AND i.item_group = %(item_group)s"
        values["item_group"] = filters.get("item_group")
    
    values["date"] = filters.get("date")
    
    items_warehouses = frappe.db.sql("""
        SELECT DISTINCT 
            sle.item_code, 
            sle.warehouse
        FROM `tabStock Ledger Entry` sle
        INNER JOIN `tabItem` i ON i.name = sle.item_code
        WHERE sle.docstatus = 1
            AND i.is_stock_item = 1
            AND i.disabled = 0
            AND (
                sle.posting_date = %(date)s 
                OR EXISTS (
                    SELECT 1 FROM `tabBin` b 
                    WHERE b.item_code = sle.item_code 
                    AND b.warehouse = sle.warehouse 
                    AND b.actual_qty != 0
                )
            )
            {conditions}
        ORDER BY sle.item_code, sle.warehouse
    """.format(conditions=conditions), values, as_list=1)
    
    return items_warehouses

def get_opening_balance(item_code, warehouse, date, from_time="00:00:00"):
    if from_time == "00:00:00":
        opening_balance = frappe.db.sql("""
            SELECT IFNULL(SUM(actual_qty), 0)
            FROM `tabStock Ledger Entry`
            WHERE item_code = %s
            AND warehouse = %s
            AND posting_date < %s
            AND docstatus = 1
        """, (item_code, warehouse, date))[0][0] or 0
    else:
        opening_balance = frappe.db.sql("""
            SELECT IFNULL(SUM(actual_qty), 0)
            FROM `tabStock Ledger Entry`
            WHERE item_code = %s
            AND warehouse = %s
            AND ((posting_date < %s) 
                OR (posting_date = %s AND posting_time < %s))
            AND docstatus = 1
        """, (item_code, warehouse, date, date, from_time))[0][0] or 0
    
    return flt(opening_balance)

def get_daily_movements(item_code, warehouse, date, from_time="00:00:00", to_time="23:59:59"):
    movements = frappe.db.sql("""
        SELECT 
            voucher_type,
            voucher_no,
            SUM(CASE WHEN actual_qty > 0 THEN actual_qty ELSE 0 END) as in_qty,
            SUM(CASE WHEN actual_qty < 0 THEN ABS(actual_qty) ELSE 0 END) as out_qty,
            SUM(CASE WHEN actual_qty > 0 THEN actual_qty * IFNULL(valuation_rate, 0) ELSE 0 END) as in_value,
            SUM(CASE WHEN actual_qty < 0 THEN ABS(IFNULL(stock_value_difference, 0)) ELSE 0 END) as out_value
        FROM `tabStock Ledger Entry`
        WHERE item_code = %s
            AND warehouse = %s
            AND posting_date = %s
            AND posting_time BETWEEN %s AND %s
            AND docstatus = 1
        GROUP BY voucher_type, voucher_no
    """, (item_code, warehouse, date, from_time, to_time), as_dict=1)
    
    result = {
        "purchases_qty": 0,
        "purchases_value": 0,
        "sold_qty": 0,
        "cogs": 0,
        "sales_revenue": 0,
        "other_movements": 0
    }
    
    purchase_types = ["Purchase Receipt", "Purchase Invoice"]
    sales_types = ["Delivery Note", "Sales Invoice"]
    sales_invoices = []
    delivery_notes = []
    
    for movement in movements:
        if movement.voucher_type in purchase_types:
            result["purchases_qty"] += flt(movement.in_qty)
            result["purchases_value"] += flt(movement.in_value)
        elif movement.voucher_type in sales_types:
            result["sold_qty"] += flt(movement.out_qty)
            result["cogs"] += flt(movement.out_value)
            if movement.voucher_type == "Sales Invoice":
                sales_invoices.append(movement.voucher_no)
            elif movement.voucher_type == "Delivery Note":
                delivery_notes.append(movement.voucher_no)
        else:
            result["other_movements"] += flt(movement.in_qty) - flt(movement.out_qty)
    
    sales_revenue = 0
    
    if sales_invoices:
        invoice_data = frappe.db.sql("""
            SELECT SUM(sii.base_amount) as revenue
            FROM `tabSales Invoice Item` sii
            INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
            WHERE sii.parent IN %s
                AND sii.item_code = %s
                AND (sii.warehouse = %s OR sii.warehouse IS NULL)
                AND si.docstatus = 1
                AND si.is_return = 0
        """, (sales_invoices, item_code, warehouse), as_dict=1)
        
        if invoice_data and invoice_data[0].revenue:
            sales_revenue += flt(invoice_data[0].revenue)
    
    if delivery_notes:
        dn_data = frappe.db.sql("""
            SELECT SUM(dni.base_amount) as revenue
            FROM `tabDelivery Note Item` dni
            INNER JOIN `tabDelivery Note` dn ON dn.name = dni.parent
            WHERE dni.parent IN %s
                AND dni.item_code = %s
                AND (dni.warehouse = %s OR dni.warehouse IS NULL)
                AND dn.docstatus = 1
                AND dn.is_return = 0
                AND NOT EXISTS (
                    SELECT 1 FROM `tabSales Invoice Item` sii
                    INNER JOIN `tabSales Invoice` si ON si.name = sii.parent
                    WHERE sii.delivery_note = dni.parent
                    AND sii.dn_detail = dni.name
                    AND si.docstatus = 1
                )
        """, (delivery_notes, item_code, warehouse), as_dict=1)
        
        if dn_data and dn_data[0].revenue:
            sales_revenue += flt(dn_data[0].revenue)
    
    if sales_revenue == 0 and result["sold_qty"] > 0:
        
        price_data = frappe.db.sql("""
            SELECT ip.price_list_rate, pl.currency
            FROM `tabItem Price` ip
            INNER JOIN `tabPrice List` pl ON pl.name = ip.price_list
            WHERE ip.item_code = %s 
                AND ip.selling = 1
                AND (ip.customer IS NULL OR ip.customer = '')
                AND pl.enabled = 1
                AND (ip.valid_from IS NULL OR ip.valid_from <= %s)
                AND (ip.valid_upto IS NULL OR ip.valid_upto >= %s)
            ORDER BY 
                CASE WHEN pl.name = 'Standard Selling' THEN 1 ELSE 2 END,
                ip.valid_from DESC
            LIMIT 1
        """, (item_code, date, date), as_dict=1)
        
        if price_data and price_data[0].price_list_rate:
            sales_revenue = flt(result["sold_qty"]) * flt(price_data[0].price_list_rate)
        else:
            
            item_details = frappe.db.get_value("Item", item_code, 
                ["standard_rate", "valuation_rate"], as_dict=1)
            
            if item_details and item_details.standard_rate:
                sales_revenue = flt(result["sold_qty"]) * flt(item_details.standard_rate)
            elif item_details and item_details.valuation_rate:
                sales_revenue = flt(result["sold_qty"]) * flt(item_details.valuation_rate) * 1.25
            elif result["cogs"] > 0:
                sales_revenue = flt(result["cogs"]) * 1.25
    
    result["sales_revenue"] = flt(sales_revenue)
    
    return result