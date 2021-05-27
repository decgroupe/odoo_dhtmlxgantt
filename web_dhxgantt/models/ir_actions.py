from odoo import fields, models
from odoo.addons.web_dhxgantt.models.ir_ui_view import GANTT_VIEW


class ActWindowView(models.Model):
    _inherit = 'ir.actions.act_window.view'

    view_mode = fields.Selection(selection_add=[GANTT_VIEW])
