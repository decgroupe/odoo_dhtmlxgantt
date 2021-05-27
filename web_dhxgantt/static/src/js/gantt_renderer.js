odoo.define('web_dhxgantt.GanttRenderer', function (require) {
    "use strict";

    var AbstractRenderer = require('web.AbstractRenderer');
    var FormRenderer = require('web.FormRenderer');
    // var BasicRenderer = require('web.BasicRenderer');
    // var dialogs = require('web.view_dialogs');

    // FormRenderer.include({
    //     events: _.extend({}, FormRenderer.prototype.events, {
    //         'click button.o_dhx_gantt': '_onClickShowGantt',
    //     }),
    //     _onClickShowGantt: function(){
    //         console.log('well hello');
    //     },
    //     init: function () {
    //         this._super.apply(this, arguments);
    //         console.log('init() GanttFormRenderer');
    //     },
    // });

    var GanttRenderer = AbstractRenderer.extend({
        template: "web_dhxgantt.gantt_view",
        ganttApiUrl: "/gantt_api",
        date_object: new Date(),
        events: _.extend({}, AbstractRenderer.prototype.events, {
            'click button.o_dhx_critical_path': '_onClickCriticalPath',
            'click button.o_dhx_reschedule': '_onClickReschedule',
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
            // console.log('params');
            // console.log(params);

            var self = this;
            // todo: make this read from some database variable
            // gantt.templates.scale_cell_class = function(date){
            //     if(date.getDay()==5||date.getDay()==6){
            //         return "o_dhx_gantt_weekend";
            //     }
            // };

            gantt.config.work_time = true;
            gantt.config.skip_off_time = true;
            // console.log('columns');
            // console.log(gantt.config.columns);

            gantt.config.columns = [
                { name: "text", tree: true, resize: true },
                { name: "start_date", align: "center", resize: true },
                { name: "duration", align: "center" },
                // {name: "add", width: 44, min_width: 44, max_width: 44}
            ]
            if (this.is_total_float) {
                gantt.config.columns.push({ name: "total_float", label: "Total Float", align: "center" })
            }

            gantt.setWorkTime({ day: 5, hours: false });
            gantt.setWorkTime({ day: 6, hours: true });
            gantt.setWorkTime({ day: 0, hours: true });
            gantt.setWorkTime({ hours: [0, 23] });
            // (duplicate)todo: make this read from some database variable
            // gantt.templates.timeline_cell_class = function(task, date){
            //     // if(date.getDay()==5||date.getDay()==6){ 
            //     if(!gantt.isWorkTime({task:task, date: date})){
            //         return "o_dhx_gantt_weekend";
            //     }
            // };
            var zoomConfig = {
                levels: [
                    {
                        name: "day",
                        scale_height: 27,
                        min_column_width: 80,
                        scales: [
                            { unit: "day", step: 1, format: "%d %M" }
                        ]
                    },
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
                    {
                        name: "month",
                        scale_height: 50,
                        min_column_width: 120,
                        scales: [
                            { unit: "month", format: "%F, %Y" },
                            { unit: "week", format: "Week #%W" }
                        ]
                    },
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
            // console.log('renderGantt');
            gantt.init(this.$('.o_dhx_gantt').get(0));
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
                text: "Today", //the marker title
                title: date_to_str(new Date()) // the marker's tooltip
            });
            var rootHeight = this.$el.height();
            var headerHeight = this.$('.o_dhx_gantt_header').height();
            this.$('.o_dhx_gantt').height(rootHeight - headerHeight);
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
