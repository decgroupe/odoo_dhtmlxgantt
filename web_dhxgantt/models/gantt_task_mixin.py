# -*- coding: utf-8 -*-
# Copyright (C) DEC SARL, Inc - All Rights Reserved.
# Written by Yann Papouin <ypa at decgroupe.com>, Mar 2022

from odoo import models, api, fields


class GanttTaskMixin(models.AbstractModel):
    _name = 'gantt.task.mixin'
    _description = 'Gantt Task Mixin'

    gantt_class = fields.Char(
        compute="_compute_gantt_class",
        help="CSS class used to render this task in gantt view",
    )

    gantt_assigned_resource = fields.Char(
        compute="_compute_gantt_assigned_resource",
        help="Get the name of the user/resource/team assigned to this task",
    )

    @api.multi
    def gantt_schedule_update(self, backward=False):
        return []

    @api.multi
    def _get_gantt_class(self):
        self.ensure_one()
        return "decoration-info"

    @api.multi
    def _compute_gantt_class(self):
        for rec in self:
            rec.gantt_class = rec._get_gantt_class()

    @api.multi
    def _compute_gantt_assigned_resource(self):
        for rec in self:
            rec.gantt_assigned_resource = ""
