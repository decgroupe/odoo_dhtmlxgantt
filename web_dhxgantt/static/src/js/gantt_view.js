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

            this.controllerParams.projectModelName = this.arch.attrs.project_model_name;

            this.loadParams.type = 'list';
            this.loadParams.modelName = params.modelName;
            this.loadParams.linkModelName = this.arch.attrs.link_model_name;
            
            // Save fields names
            this.loadParams.identifier = this.arch.attrs.identifier;
            this.loadParams.parent = this.arch.attrs.parent;
            this.loadParams.date_start = this.arch.attrs.date_start;
            this.loadParams.duration = this.arch.attrs.duration;
            this.loadParams.open = this.arch.attrs.open;
            this.loadParams.progress = this.arch.attrs.progress;
            this.loadParams.text = this.arch.attrs.text;
            this.loadParams.linksSerializedJson = this.arch.attrs.links_serialized_json;

            // Fields to read
            this.loadParams.fieldNames = [
                this.loadParams.identifier,
                this.loadParams.parent,
                this.loadParams.date_start,
                this.loadParams.duration,
                this.loadParams.open,
                this.loadParams.progress,
                this.loadParams.text,
                this.loadParams.linksSerializedJson,
            ];

            this.rendererParams.modelName = params.modelName;
        },
        _processFieldsView: function (fieldsView, viewType) {
            var fv = this._super.apply(this, arguments);
            return fv;
        },
    })

    viewRegistry.add('dhxgantt', GanttView);
    return GanttView;
});