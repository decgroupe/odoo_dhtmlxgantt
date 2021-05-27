from odoo import fields, models

GANTT_VIEW = ('dhxgantt', 'Gantt (DHX)')


class IrUIView(models.Model):
    _inherit = 'ir.ui.view'

    type = fields.Selection(selection_add=[GANTT_VIEW])
