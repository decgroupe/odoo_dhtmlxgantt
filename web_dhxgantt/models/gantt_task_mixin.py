# -*- coding: utf-8 -*-
# Copyright (C) DEC SARL, Inc - All Rights Reserved.
# Written by Yann Papouin <ypa at decgroupe.com>, Mar 2022

from odoo import models, api


class GanttTaskMixin(models.AbstractModel):
    _name = 'gantt.task.mixin'
    _description = 'Gantt Task Mixin'

    @api.multi
    def update_gantt_schedule(self, backward=False):
        return []
