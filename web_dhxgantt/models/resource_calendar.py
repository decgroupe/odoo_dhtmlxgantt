from odoo import models, fields
from datetime import datetime, timedelta
from pytz import timezone, utc


class ResourceCalendar(models.Model):
    _inherit = 'resource.calendar'

    def plan_minutes(
        self,
        minutes,
        day_dt,
        compute_leaves=False,
        domain=None,
        resource=None
    ):
        hours = minutes / 60
        return self.plan_hours(hours, day_dt, compute_leaves, domain, resource)

    def is_before_worktime(self, dt):
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=utc)
        day_start = dt.astimezone(timezone(self.tz))
        day_start = day_start.replace(hour=0, minute=0, second=0)
        intervals = self._work_intervals(day_start.astimezone(utc), dt)
        return len(intervals) == 0

    def is_after_worktime(self, dt):
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=utc)
        day_end = dt.astimezone(timezone(self.tz))
        day_end = day_end.replace(hour=23, minute=59,
                                  second=59) + timedelta(seconds=1)
        intervals = self._work_intervals(dt, day_end.astimezone(utc))
        return len(intervals) == 0

    def snap_to_day_start(self, dt):
        tz = timezone(self.tz)
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=utc)
        dt = dt.astimezone(tz).replace(hour=0, minute=0, second=0)
        return dt.astimezone(utc).replace(tzinfo=None)

    def snap_to_day_end(self, dt):
        tz = timezone(self.tz)
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=utc)
        dt = dt.astimezone(tz).replace(hour=23, minute=59,
                                       second=59) + timedelta(seconds=1)
        return dt.astimezone(utc).replace(tzinfo=None)