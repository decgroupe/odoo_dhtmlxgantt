# Copyright (C) DEC SARL, Inc - All Rights Reserved.
# Written by Yann Papouin <ypa at decgroupe.com>, Mar 2022

from odoo import fields, models, api


class ProjectTaskType(models.Model):
    _inherit = "project.task.type"

    gantt_class = fields.Char(
        help="CSS class used to render tasks in gantt view",
    )

    @api.onchange("name")
    def onchange_name(self):
        for rec in self:
            if not rec.gantt_class:
                rec.gantt_class = rec.name.replace(" ", "_").lower()
