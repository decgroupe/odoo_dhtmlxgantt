odoo.define('web_dhxgantt.GanttRenderer', function (require) {
    "use strict";

    var AbstractRenderer = require('web.AbstractRenderer');
    var core = require('web.core');

    var _lt = core._lt;

    var GanttRenderer = AbstractRenderer.extend({
        template: "web_dhxgantt.gantt_view",
        ganttApiUrl: "/gantt_api",
        date_object: new Date(),
        events: _.extend({}, AbstractRenderer.prototype.events, {
            'click button.o_dhx_critical_path': '_onClickCriticalPath',
            'click button.o_dhx_reschedule': '_onClickReschedule',
            'click button.o_dhx_show_all': '_onClickShowAll',
            'click button.o_dhx_show_workdays': '_onClickShowWorkdays',
            'click button.o_dhx_show_officehours': '_onClickShowOfficeHours',
            'click button.o_dhx_zoom_in': '_onClickZoomIn',
            'click button.o_dhx_zoom_out': '_onClickZoomOut'
        }),
        init: function (parent, state, params) {
            // console.log('init GanttRenderer');
            this._super.apply(this, arguments);
            this.initDomain = params.initDomain;
            this.modelName = params.modelName;
            this.map_text = params.map_text;
            this.map_id_field = params.map_id_field;
            this.map_date_start = params.map_date_start;
            this.map_duration = params.map_duration;
            this.map_open = params.map_open;
            this.map_progress = params.map_progress;
            this.map_links_serialized_json = params.map_links_serialized_json;
            this.link_model = params.link_model;
            this.is_total_float = params.is_total_float;

            // TODO: make this read from some database variable
            gantt.templates.scale_cell_class = function (date) {
                if (!gantt.isWorkTime(date)) {
                    return "o_dhx_gantt_weekend";
                }
            };

            gantt.config.work_time = true;
            gantt.config.skip_off_time = true;

            gantt.config.columns = [
                { name: "text", tree: true, resize: true },
                { name: "start_date", align: "center", resize: true },
                { name: "duration", align: "center" },
                // {name: "add", width: 44, min_width: 44, max_width: 44}
            ]
            if (this.is_total_float) {
                gantt.config.columns.push({ name: "total_float", label: "Total Float", align: "center" })
            }

            // gantt.ignore_time = function (date) {
            //     return !gantt.isWorkTime(date, "day");
            // };

            // TODO: make this read from some database variable
            gantt.setWorkTime({ day: 6, hours: false });
            gantt.setWorkTime({ day: 7, hours: false });
            // gantt.setWorkTime({ hours: [8, 17] });
            gantt.setWorkTime({ hours: ["8:30-12:00", "13:30-17:00"] }); //global working hours


            // TODO: make this read from some database variable
            gantt.templates.timeline_cell_class = function (task, date) {
                if (!gantt.isWorkTime({ task: task, date: date })) {
                    return "o_dhx_gantt_weekend";
                }
            };

            var zoomConfig = {
                levels: [
                    // hours
                    {
                        name: "hour_24",
                        scale_height: 27,
                        scales: [
                            { unit: "day", step: 1, format: "%d %M" },
                            { unit: "hour", step: 1, format: "%H:%i" },
                        ]
                    },
                    // hours
                    {
                        name: "hour_6",
                        scale_height: 27,
                        scales: [
                            { unit: "day", step: 1, format: "%d %M" },
                            { unit: "hour", step: 4, format: "%H:%i" },
                        ]
                    },
                    // days
                    {
                        name: "day",
                        scale_height: 27,
                        min_column_width: 80,
                        scales: [
                            { unit: "day", step: 1, format: "%d %M" }
                        ]
                    },
                    // weeks
                    {
                        name: "week",
                        scale_height: 50,
                        min_column_width: 50,
                        scales: [
                            {
                                unit: "week", step: 1, format: function (date) {
                                    var dateToStr = gantt.date.date_to_str("%d %M");
                                    var endDate = gantt.date.add(date, +6, "day");
                                    var weekNum = gantt.date.date_to_str("%W")(date);
                                    return "#" + weekNum + ", " + dateToStr(date) + " - " + dateToStr(endDate);
                                }
                            },
                            { unit: "day", step: 1, format: "%j %D" }
                        ]
                    },
                    // months
                    {
                        name: "month",
                        scale_height: 50,
                        min_column_width: 120,
                        scales: [
                            { unit: "month", format: "%F, %Y" },
                            { unit: "week", format: "Week #%W" }
                        ]
                    },
                    // quarters
                    {
                        name: "quarter",
                        height: 50,
                        min_column_width: 90,
                        scales: [
                            { unit: "month", step: 1, format: "%M" },
                            {
                                unit: "quarter", step: 1, format: function (date) {
                                    var dateToStr = gantt.date.date_to_str("%M");
                                    var endDate = gantt.date.add(gantt.date.add(date, 3, "month"), -1, "day");
                                    return dateToStr(date) + " - " + dateToStr(endDate);
                                }
                            }
                        ]
                    },
                    // years
                    {
                        name: "year",
                        scale_height: 50,
                        min_column_width: 30,
                        scales: [
                            { unit: "year", step: 1, format: "%Y" }
                        ]
                    }
                ]
            };
            gantt.ext.zoom.init(zoomConfig);
            gantt.ext.zoom.setLevel("week");
        },
        _onClickCriticalPath: function () {
            // console.log('_onClickCriticalPath');
            this.trigger_up('gantt_show_critical_path');
        },
        _onClickReschedule: function () {
            // console.log('_onClickReschedule');
            this.trigger_up('gantt_schedule');
        },
        _onClickShowAll: function () {
            gantt.ignore_time = null;
            gantt.render();
        },
        _onClickShowWorkdays: function () {
            gantt.ignore_time = function (date) {
                return !gantt.isWorkTime(date, "day");
            };
            gantt.render();
        },
        _onClickShowOfficeHours: function () {
            gantt.ignore_time = function (date) {
                return !gantt.isWorkTime(date);
            };
            gantt.render();
        },
        _onClickZoomIn: function () {
            // console.log('_onClickZoomIn');
            gantt.ext.zoom.zoomIn();
        },
        _onClickZoomOut: function () {
            // console.log('_onClickZoomOut');
            gantt.ext.zoom.zoomOut();
        },
        on_attach_callback: function () {
            this.renderGantt();
            // console.log('on_attach_callback');
            // console.log(this.$el);
        },
        renderGantt: function () {
            var gantt_container = this.$('.o_dhx_gantt').get(0)
            gantt.plugins({
                marker: true
            });
            this.trigger_up('gantt_config');
            this.trigger_up('gantt_create_dp');
            if (!this.events_set) {
                var self = this;
                gantt.attachEvent('onBeforeGanttRender', function () {
                    // console.log('tadaaaa, onBeforeGanttRender');
                    var rootHeight = self.$el.height();
                    var headerHeight = self.$('.o_dhx_gantt_header').height();
                    self.$('.o_dhx_gantt').height(rootHeight - headerHeight);
                });
                this.events_set = true;
            }
            gantt.clearAll();
            var date_to_str = gantt.date.date_to_str(gantt.config.task_date);
            gantt.addMarker({
                start_date: new Date(), //a Date object that sets the marker's date
                css: "today", //a CSS class applied to the marker
                text: _lt("Today"), //the marker title
                title: date_to_str(new Date()) // the marker's tooltip
            });
            var rootHeight = this.$el.height();
            var headerHeight = this.$('.o_dhx_gantt_header').height();
            this.$('.o_dhx_gantt').height(rootHeight - headerHeight);

            // Set locale (lang) from current user settings
            var context = this.getSession().user_context;
            var locale = context.lang.substring(0, 2) || 'en_US';
            gantt.i18n.setLocale(locale);

            gantt.init(gantt_container);
            gantt.parse(this.state.records);
        },
        _onUpdate: function () {
        },
        updateState: function (state, params) {
            // this method is called by the controller when the search view is changed. we should 
            // clear the gantt chart, and add the new tasks resulting from the search
            var res = this._super.apply(this, arguments);
            gantt.clearAll();
            this.renderGantt();
            return res;
        },
        disableAllButtons: function () {
            // console.log('disableAllButtons:: Renderer');
            this.$('.o_dhx_gantt_header').find('button').prop('disabled', true);
        },
        enableAllButtons: function () {
            // console.log('enableAllButtons:: Renderer');
            this.$('.o_dhx_gantt_header').find('button').prop('disabled', false);
        },
        undoRenderCriticalTasks: function (data) {
            gantt.eachTask(function (item) {
                item.color = "";
            });
            gantt.getLinks().forEach(function (item) {
                item.color = "";
            });
            gantt.render();
        },
        renderCriticalTasks: function (data) {
            data.tasks.forEach(function (item) {
                var task = gantt.getTask(item);
                if (task) {
                    task.color = "red";
                }
            });
            data.links.forEach(function (item) {
                var link = gantt.getLink(item);
                if (link) {
                    link.color = "red";
                }
            });
            if (data.tasks.length > 0) {
                gantt.render();
            }
        },
        destroy: function () {
            gantt.clearAll();
            this._super.apply(this, arguments);
        },
    });
    return GanttRenderer;
});
