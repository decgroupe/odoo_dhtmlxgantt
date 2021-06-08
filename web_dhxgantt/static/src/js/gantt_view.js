odoo.define('web_dhxgantt.GanttView', function (require) {
    "use strict";

    var core = require('web.core');
    var AbstractView = require('web.AbstractView');
    var GanttController = require('web_dhxgantt.GanttController');
    var GanttModel = require('web_dhxgantt.GanttModel');
    var GanttRenderer = require('web_dhxgantt.GanttRenderer');
    var viewRegistry = require('web.view_registry');

    var _lt = core._lt;

    var GanttView = AbstractView.extend({
        viewType: 'dhxgantt',
        display_name: _lt('Gantt'),
        icon: 'fa-tasks',
        config: _.extend({}, AbstractView.prototype.config, {
            Controller: GanttController,
            Model: GanttModel,
            Renderer: GanttRenderer,
        }),
        init: function (viewInfo, params) {
            this._super.apply(this, arguments);
            this.loadParams.type = 'list';

            this.loadParams.id_field = this.arch.attrs.id_field;
            this.loadParams.parent = this.arch.attrs.parent;
            this.loadParams.date_start = this.arch.attrs.date_start;
            this.loadParams.duration = this.arch.attrs.duration;
            this.loadParams.open = this.arch.attrs.open;
            this.loadParams.progress = this.arch.attrs.progress;
            this.loadParams.text = this.arch.attrs.text;
            this.loadParams.links_serialized_json = this.arch.attrs.links_serialized_json;
            this.loadParams.total_float = this.arch.attrs.total_float;
            this.loadParams.modelName = params.modelName;
            this.loadParams.linkModel = this.arch.attrs.link_model;

            this.loadParams.fieldNames = [
                this.arch.attrs.id_field,
                this.arch.attrs.parent,
                this.arch.attrs.date_start,
                this.arch.attrs.duration,
                this.arch.attrs.open,
                this.arch.attrs.progress,
                this.arch.attrs.text,
                this.arch.attrs.links_serialized_json,
            ];

            this.rendererParams.initDomain = params.domain;
            this.rendererParams.modelName = params.modelName;
            this.rendererParams.map_id_field = this.arch.attrs.id_field;
            this.rendererParams.map_date_start = this.arch.attrs.date_start;
            this.rendererParams.map_duration = this.arch.attrs.duration;
            this.rendererParams.map_open = this.arch.attrs.open;
            this.rendererParams.map_progress = this.arch.attrs.progress;
            this.rendererParams.map_text = this.arch.attrs.text;
            this.rendererParams.map_links_serialized_json = this.arch.attrs.links_serialized_json;
            this.rendererParams.link_model = this.arch.attrs.link_model;
            this.rendererParams.link_model = this.arch.attrs.link_model;
            this.rendererParams.is_total_float = this.arch.attrs.total_float;

        },
        _processFieldsView: function (fieldsView, viewType) {
            var fv = this._super.apply(this, arguments);
            return fv;
        },
    })

    viewRegistry.add('dhxgantt', GanttView);
    return GanttView;
});