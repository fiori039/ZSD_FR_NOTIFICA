/*global location */
sap.ui.define([
	"com/corona/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/corona/model/formatter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/Button",
	"sap/m/Dialog",
	"sap/m/Text"
], function(BaseController, JSONModel, formatter, MessageBox, MessageToast, Filter, FilterOperator, Button, Dialog, Text) {
	"use strict";
	var _timeout;

	return BaseController.extend("com.corona.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading")
			});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
			this.setModel(oViewModel, "detailView");
			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
			this._oODataModel = this.getOwnerComponent().getModel();
			this._oResourceBundle = this.getResourceBundle();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share by E-Mail button has been clicked
		 * @public
		 */
		onShareEmailPress: function() {
			var oViewModel = this.getModel("detailView");

			sap.m.URLHelper.triggerEmail(
				null,
				oViewModel.getProperty("/shareSendEmailSubject"),
				oViewModel.getProperty("/shareSendEmailMessage")
			);
		},

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			var oViewModel = this.getModel("detailView"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});

			oShareDialog.open();
		},

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onListUpdateFinished: function(oEvent) {
			var sTitle,
				iTotalItems = oEvent.getParameter("total"),
				oViewModel = this.getModel("detailView");

			// only update the counter if the length is final
			// if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
			if (this.byId("tbl_conjunto").getBinding("items").isLengthFinal()) {
				if (iTotalItems) {
					sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
				} else {
					//Display 'Line Items' instead of 'Line items (0)'
					sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
				}
				oViewModel.setProperty("/lineItemListTitle", sTitle);
			}
		},

		/**
		 * Event handler (attached declaratively) for the view delete button. Deletes the selected item. 
		 * @function
		 * @public
		 */
		onDelete: function() {
			var that = this;
			var oViewModel = this.getModel("detailView"),
				sPath = oViewModel.getProperty("/sObjectPath"),
				sObjectHeader = this._oODataModel.getProperty(sPath + "/Aufnr"),
				sQuestion = this._oResourceBundle.getText("deleteText", sObjectHeader),
				sSuccessMessage = this._oResourceBundle.getText("deleteSuccess", sObjectHeader);

			var fnMyAfterDeleted = function() {
				MessageToast.show(sSuccessMessage);
				oViewModel.setProperty("/busy", false);
				var oNextItemToSelect = that.getOwnerComponent().oListSelector.findNextItem(sPath);
				that.getModel("appView").setProperty("/itemToSelect", oNextItemToSelect.getBindingContext().getPath()); //save last deleted
			};
			this._confirmDeletionByUser({
				question: sQuestion
			}, [sPath], fnMyAfterDeleted);
		},

		/**
		 * Event handler (attached declaratively) for the view edit button. Open a view to enable the user update the selected item. 
		 * @function
		 * @public
		 */
		onEdit: function() {
			this.getModel("appView").setProperty("/addEnabled", false);
			var sObjectPath = this.getView().getElementBinding().getPath();
			this.getRouter().getTargets().display("create", {
				mode: "update",
				objectPath: sObjectPath
			});
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			var oParameter = oEvent.getParameter("arguments");
			for (var value in oParameter) {
				oParameter[value] = decodeURIComponent(oParameter[value]);
			}
			this.getModel().metadataLoaded().then(function() {
				var sObjectPath = this.getModel().createKey("OrdenServicioSet", oParameter);
				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function(sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		/**
		 * Event handler for binding change event
		 * @function
		 * @private
		 */

		_onBindingChange: function() {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding(),
				oViewModel = this.getModel("detailView"),
				oAppViewModel = this.getModel("appView");

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getBoundContext().getPath(),
				oResourceBundle = this.getResourceBundle(),
				oObject = oView.getModel().getObject(sPath),
				sObjectId = oObject.Aufnr,
				sObjectName = oObject.Aufnr;

			oViewModel.setProperty("/sObjectId", sObjectId);
			oViewModel.setProperty("/sObjectPath", sPath);
			oAppViewModel.setProperty("/itemToSelect", sPath);
			this.getOwnerComponent().oListSelector.selectAListItem(sPath);

			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("shareSaveTileAppTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},

		/**
		 * Event handler for metadata loaded event
		 * @function
		 * @private
		 */

		_onMetadataLoaded: function() {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView"),
				oLineItemTable = this.byId("lineItemsList"),
				iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);
			oViewModel.setProperty("/lineItemTableDelay", 0);

			oLineItemTable.attachEventOnce("updateFinished", function() {
				// Restore original busy indicator delay for line item table
				oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
			});

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},

		/**
		 * Opens a dialog letting the user either confirm or cancel the deletion of a list of entities
		 * @param {object} oConfirmation - Possesses up to two attributes: question (obligatory) is a string providing the statement presented to the user.
		 * title (optional) may be a string defining the title of the popup.
		 * @param {object} oConfirmation - Possesses up to two attributes: question (obligatory) is a string providing the statement presented to the user.
		 * @param {array} aPaths -  Array of strings representing the context paths to the entities to be deleted. Currently only one is supported.
		 * @param {callback} fnAfterDeleted (optional) - called after deletion is done. 
		 * @param {callback} fnDeleteCanceled (optional) - called when the user decides not to perform the deletion
		 * @param {callback} fnDeleteConfirmed (optional) - called when the user decides to perform the deletion. A Promise will be passed
		 * @function
		 * @private
		 */
		/* eslint-disable */ // using more then 4 parameters for a function is justified here
		_confirmDeletionByUser: function(oConfirmation, aPaths, fnAfterDeleted, fnDeleteCanceled, fnDeleteConfirmed) {
			/* eslint-enable */
			// Callback function for when the user decides to perform the deletion
			var fnDelete = function() {
				// Calls the oData Delete service
				this._callDelete(aPaths, fnAfterDeleted);
			}.bind(this);

			// Opens the confirmation dialog
			MessageBox.show(oConfirmation.question, {
				icon: oConfirmation.icon || MessageBox.Icon.WARNING,
				title: oConfirmation.title || this._oResourceBundle.getText("delete"),
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.OK) {
						fnDelete();
					} else if (fnDeleteCanceled) {
						fnDeleteCanceled();
					}
				}
			});
		},

		/**
		 * Performs the deletion of a list of entities.
		 * @param {array} aPaths -  Array of strings representing the context paths to the entities to be deleted. Currently only one is supported.
		 * @param {callback} fnAfterDeleted (optional) - called after deletion is done. 
		 * @return a Promise that will be resolved as soon as the deletion process ended successfully.
		 * @function
		 * @private
		 */
		_callDelete: function(aPaths, fnAfterDeleted) {
			var oViewModel = this.getModel("detailView");
			oViewModel.setProperty("/busy", true);
			var fnFailed = function() {
				this._oODataModel.setUseBatch(true);
			}.bind(this);
			var fnSuccess = function() {
				if (fnAfterDeleted) {
					fnAfterDeleted();
					this._oODataModel.setUseBatch(true);
				}
				oViewModel.setProperty("/busy", false);
			}.bind(this);
			return this._deleteOneEntity(aPaths[0], fnSuccess, fnFailed);
		},

		/**
		 * Deletes the entity from the odata model
		 * @param {array} aPaths -  Array of strings representing the context paths to the entities to be deleted. Currently only one is supported.
		 * @param {callback} fnSuccess - Event handler for success operation.
		 * @param {callback} fnFailed - Event handler for failure operation.
		 * @function
		 * @private
		 */
		_deleteOneEntity: function(sPath, fnSuccess, fnFailed) {
			var oPromise = new Promise(function(fnResolve, fnReject) {
				this._oODataModel.setUseBatch(false);
				this._oODataModel.remove(sPath, {
					success: fnResolve,
					error: fnReject,
					async: true
				});
			}.bind(this));
			oPromise.then(fnSuccess, fnFailed);
			return oPromise;
		},
		
		//#NETORIVERA
		
		/**************************
		 * Ayuda de busqueda Status
		 **************************/
		 
		 /**
		 * Abriri ayuda de busqueda Estatus
		 * @function
		 * @public
		 */
		 handleValueHelp_status: function(oController) {
			//this.inputId = oController.oSource.sId;
			// create value help dialog
			if (!this._valueHelpDialog_status) {
				this._valueHelpDialog_status = sap.ui.xmlfragment("com.corona.fragment.DlgStatus", this);
				this.getView().addDependent(this._valueHelpDialog_status);
			}
			// open value help dialog
			this._valueHelpDialog_status.open();
		},
		
		/**
		 * Filtrar en la ayuda de busqueda Estatus
		 * @function
		 * @public
		 */
		_handleValueHelpSearch_status: function(evt) {
			var sValue = evt.getParameter("value");
			var oFilter = new Filter("Txt04", sap.ui.model.FilterOperator.Contains, sValue);
			evt.getSource().getBinding("items").sOperationMode = "Client";
			evt.getSource().getBinding("items").filter([oFilter]);
		},
		
		/**
		 * Cerrar ayuda de busqueda Estatus
		 * @function
		 * @public
		 */
		_handleValueHelpClose_status: function(evt) {
			var oSelectedItem = evt.getParameter("selectedItem");
			//Se obtiene el contexto para los datos del Aviso Seleccionado
			var bindingContext = this.getView().getBindingContext();
			var pathAviso = bindingContext.getPath();

			if (oSelectedItem) {
				var estatus_usr = this.getView().byId("txt_status_usr");
				estatus_usr.setValue(oSelectedItem.getDescription());

				this.getView().getModel().setProperty(pathAviso + '/StatusSet', oSelectedItem.getTitle());
			}
			evt.getSource().getBinding("items").filter([]);
		},

		/********************************
		 * Ayuda de busqueda Actividad PM
		 ********************************/		
		
		/**
		 * Abrir ayuda de busqueda Actividad PM
		 * @function
		 * @public
		 */
		handleValueHelp_actividad: function(oController) {
			//this.inputId = oController.oSource.sId;
			// create value help dialog
			if (!this._valueHelpDialog_actividad) {
				this._valueHelpDialog_actividad = sap.ui.xmlfragment("com.corona.fragment.DlgActividad", this);
				this.getView().addDependent(this._valueHelpDialog_actividad);
			}
			// open value help dialog
			this._valueHelpDialog_actividad.open();
		},
		
		/**
		 * Filtrar en la ayuda de busqueda Actividad PM
		 * @function
		 * @public
		 */
		_handleValueHelpSearch_actividad: function(evt) {
			var sValue = evt.getParameter("value");
			var oFilter = new Filter("Auart", sap.ui.model.FilterOperator.Contains, sValue);
			evt.getSource().getBinding("items").sOperationMode = "Client";
			evt.getSource().getBinding("items").filter([oFilter]);
		},
		
		/**
		 * Cerrar ayuda de busqueda Actividad PM
		 * @function
		 * @public
		 */
		_handleValueHelpClose_actividad: function(evt) {
			var oSelectedItem = evt.getParameter("selectedItem");
			//Se obtiene el contexto para los datos del Aviso Seleccionado
			var bindingContext = this.getView().getBindingContext();
			var pathAviso = bindingContext.getPath();

			if (oSelectedItem) {
				var estatus_usr = this.getView().byId("txt_actividad");
				estatus_usr.setValue(oSelectedItem.getDescription());

				this.getView().getModel().setProperty(pathAviso + '/ActividadSet', oSelectedItem.getTitle());
			}
			evt.getSource().getBinding("items").filter([]);
		},

		/***********************************
		 * Operaciones por Orden de Servicio
		 ***********************************/
		 
		 /**
		 * Abrir ventana Operaciones por Orden
		 * @function
		 * @public
		 */
		 f_dialogo_notificar: function(event) {
			// var getPath = event.getSource()._oSelectedItem.getBindingContext().getPath();
			var BindingContext = event.getSource()._oSelectedItem.getBindingContext();
		 	
			if(BindingContext.getProperty("Aueru") === "X"){
				this.f_MessageBoxPress(event, "Operación con Notificación Final", "error");
				//Liberar posición seleccionada
				var list_operacion = this.getView().byId("tbl_operacion");
				list_operacion.removeSelections(true);
				return;
		 	}
		 	
			if(!this._dialogo_operacion) {
				this._dialogo_operacion = sap.ui.xmlfragment("com.corona.fragment.NotificarOperacion", this);
				this.getView().addDependent(this._dialogo_operacion);
			}
			
			//Asignar Código de Orden
			var orden = sap.ui.getCore().byId("txt_orden");
				orden.setValue(BindingContext.getProperty("Aufnr"));
			
			//Asignar Posición
			var posicion = sap.ui.getCore().byId("txt_posicion");
				posicion.setValue(BindingContext.getProperty("Vornr"));
			
			//Asignar Actividad
			var actividad = sap.ui.getCore().byId("txt_actividad");	
				actividad.setValue(BindingContext.getProperty("Ltxa1"));
			
			//Asignar Trabajo Real (unidad de medida)
			var trabajo_unidad = sap.ui.getCore().byId("txt_trabajoreal_unidad");
				trabajo_unidad.setValue(BindingContext.getProperty("Arbeh"));
			
			//Abrir ventana de dialogo
			this._dialogo_operacion.open();
		},
		
		/**
		 * Cerrar ventana Operaciones por Orden
		 * @function
		 * @public
		 */
		f_close_dialogo_notificar: function() {
			//Limpiar ventana
			sap.ui.getCore().byId("txt_orden").setValue(null);

			sap.ui.getCore().byId("txt_posicion").setValue(null);
			sap.ui.getCore().byId("txt_actividad").setValue(null);

			sap.ui.getCore().byId("txt_trabajoreal_tiempo").setValue(null);
			sap.ui.getCore().byId("txt_trabajoreal_unidad").setValue(null);
			
			sap.ui.getCore().byId("cbx_notificacion_final").setSelected(false);
			sap.ui.getCore().byId("cbx_compensar_reserva").setSelected(false);
			
			sap.ui.getCore().byId("txt_inicio_fecha").setValue(null);
			sap.ui.getCore().byId("txt_inicio_hora").setValue(null);
			
			sap.ui.getCore().byId("txt_fin_fecha").setValue(null);
			sap.ui.getCore().byId("txt_fin_hora").setValue(null);
			
			//Cerrar ventana
			this._dialogo_operacion.close();

			//Liberar posición seleccionada
			var list_operacion = this.getView().byId("tbl_operacion");
			list_operacion.removeSelections(true);
		},
		
		/**
		 * Actualizar Fecha y Hora final, basado en el tiempo (MIN) ingresado por el usuario
		 * @function
		 * @public
		 */
		f_actualizar_fecha_hora_fin: function(event) {
			var trabajoreal_tiempo = sap.ui.getCore().byId("txt_trabajoreal_tiempo").getValue();
			
			var inicio_fecha = sap.ui.getCore().byId("txt_inicio_fecha").getValue();
			var inicio_hora  = sap.ui.getCore().byId("txt_inicio_hora").getValue();
			
			if(trabajoreal_tiempo === "") {
				sap.ui.getCore().byId("txt_fin_fecha").setValue(null);
				sap.ui.getCore().byId("txt_fin_hora").setValue(null);
				// this.f_MessageDialog("Warning", "Debe ingresar tiempo real del trabajo.");
				return;
			}
			
			if(inicio_fecha === "") {
				sap.ui.getCore().byId("txt_fin_fecha").setValue(null);
			}
			
			if(inicio_hora === "") {
				sap.ui.getCore().byId("txt_fin_hora").setValue(null);
			}
			
			if(inicio_fecha !== "" && inicio_hora !== "") {
				var inicio_fecha_hora = inicio_fecha + "T" + inicio_hora + ":00-05:00";
					inicio_fecha_hora = new Date(inicio_fecha_hora);
				
				var fin_fecha_hora = inicio_fecha_hora;
					fin_fecha_hora.setMinutes(inicio_fecha_hora.getMinutes() + parseInt(trabajoreal_tiempo));
				
				var fin_aa = fin_fecha_hora.getFullYear();
				var fin_mm = fin_fecha_hora.getMonth() + 1;
				var fin_dd = fin_fecha_hora.getDate();
				
				var fin_hr = fin_fecha_hora.getHours();
				var fin_mn = fin_fecha_hora.getMinutes();
				
				sap.ui.getCore().byId("txt_fin_fecha").setValue( fin_aa + "-" + fin_mm + "-" + fin_dd);
				sap.ui.getCore().byId("txt_fin_hora").setValue( fin_hr + ":" + fin_mn );
			} 
		},
		
		/**
		 * Notificar Orden de Servicio
		 * @function
		 * @public
		 */
		f_crear_notificar: function(event) {
			debugger;
			var respuesta, tp_mensaje = [];
			//Validar campos
			this.f_obligatorio_notificar();
			//Abrir cargando
			this.onOpenDialog(event);
			
			_timeout = jQuery.sap.delayedCall(500, this, function() {
				//Mapear datos
				var modelNotificar = this.f_mapear_notificar();
				
				//Definir modelo
				var serviceUrl = this.getView().getBindingContext().getModel().sServiceUrl;
				var oModel = new sap.ui.model.odata.ODataModel(serviceUrl, true);
				
				//Consumir WS
				respuesta = this.f_crear_entity(oModel, "/OperacionOrdSerSet", modelNotificar);
				tp_mensaje = respuesta.split('-', 2);
				this._dialog.close();
				// this.f_close_dialogo_conjunto();
				this.f_MessageBoxPress(event, tp_mensaje[1], tp_mensaje[0]);
			});
		},
		
		/**
		 * Validar campos obligatorios en ventana Notificar
		 * @function
		 * @public
		 */
		f_obligatorio_notificar: function() {
			
			if(sap.ui.getCore().byId("txt_trabajoreal_tiempo").getValue() === "") {
				this.f_MessageDialog("Warning", "El campo Trabajo Real es obligatorio.");
				return;
			}
			
			if(sap.ui.getCore().byId("cbx_notificacion_final").getSelected() === "") {
				this.f_MessageDialog("Warning", "El campo Notificación Final es obligatorio.");
				return;
			}
			
			if(sap.ui.getCore().byId("cbx_compensar_reserva").getSelected() === "") {
				this.f_MessageDialog("Warning", "El campo Compensar Reserva es obligatorio.");
				return;
			}
			
			if(sap.ui.getCore().byId("txt_inicio_fecha").getValue() === "") {
				this.f_MessageDialog("Warning", "El campo Fecha Inicio es obligatorio.");
				return;
			}
			
			if(sap.ui.getCore().byId("txt_inicio_hora").getValue() === "") {
				this.f_MessageDialog("Warning", "El campo Hora Inicio es obligatorio.");
				return;
			}
		},

		/**
		 * Mapear campos para Notificar
		 * @function
		 * @public
		 */		
		f_mapear_notificar: function() {
			var oEntry = {};

			oEntry.Aufnr = sap.ui.getCore().byId("txt_orden").getValue(); //context.getProperty("Aufnr");
			
			oEntry.Vornr = sap.ui.getCore().byId("txt_posicion").getValue();
			oEntry.Ltxa1 = sap.ui.getCore().byId("txt_actividad").getValue();
			
			oEntry.Arbei = sap.ui.getCore().byId("txt_trabajoreal_tiempo").getValue();
			oEntry.Arbeh = sap.ui.getCore().byId("txt_trabajoreal_unidad").getValue();
			
			oEntry.Aueru = sap.ui.getCore().byId("cbx_notificacion_final").getSelected() === true ? 'X' : ' ';
			oEntry.Ausor = sap.ui.getCore().byId("cbx_compensar_reserva").getSelected() === true ? 'X' : ' ';
			
			oEntry.Isdd = this.convertir_fecha(sap.ui.getCore().byId("txt_inicio_fecha").getValue());
			oEntry.Isdz = this.convertir_hora(sap.ui.getCore().byId("txt_inicio_hora").getValue());
			
			oEntry.Iedd = this.convertir_fecha(sap.ui.getCore().byId("txt_fin_fecha").getValue());
			oEntry.Iedz = this.convertir_hora(sap.ui.getCore().byId("txt_fin_hora").getValue());
			
			return oEntry;
		},
		
		/********************
		 * Conjunto por Aviso
		 ********************/
		 
		 /**
		 * Abrir ventana Conjunto por Aviso
		 * @function
		 * @public
		 */
		 f_dialogo_conjunto: function(event) {
			if (!this._dialogo_conjunto) {
				this._dialogo_conjunto = sap.ui.xmlfragment("com.corona.fragment.ConjuntoMedidas", this);
				this.getView().addDependent(this._dialogo_conjunto);
			}
			var getPath = event.getSource()._oSelectedItem.getBindingContext().getPath();
			var BindingContext = event.getSource()._oSelectedItem.getBindingContext();
			
			//Se mapea Código de Material
			var material = sap.ui.getCore().getElementById("cod_material_select");
				material.setValue(BindingContext.getProperty("Bautl"));
			
			//Se mapea Descripción de Material.
			var dec_material = sap.ui.getCore().getElementById("desc_material_select");
				dec_material.setValue(BindingContext.getProperty("Bautx"));

			//Se mapea Sintoma.
			var cod_sintoma = sap.ui.getCore().getElementById("cod_sintoma_select");
				cod_sintoma.setValue(BindingContext.getProperty("Fegrp") + "/" + BindingContext.getProperty("Fecod"));
			var text_sintoma = sap.ui.getCore().getElementById("text_sintoma");
				text_sintoma.setText(BindingContext.getProperty("Txtcdfe"));

			//Se mapea Parte. 
			var cod_parte = sap.ui.getCore().getElementById("cod_parte_select");
				cod_parte.setValue(BindingContext.getProperty("Otgrp") + "/" + BindingContext.getProperty("Oteil"));
			var text_parte = sap.ui.getCore().getElementById("text_parte");
				text_parte.setText(BindingContext.getProperty("Txtcdot"));

			//Se mapea Causa. 
			var cod_causa = sap.ui.getCore().getElementById("cod_causa_select");
				cod_causa.setValue(BindingContext.getProperty("Urgrp") + "/" + BindingContext.getProperty("Oteil"));
			var text_causa = sap.ui.getCore().getElementById("text_causa");
				text_causa.setText(BindingContext.getProperty("Txtcdur"));

			//Se mapea Cantidad
			var cantidad = sap.ui.getCore().getElementById("cantidad_select");
			cantidad.setValue(BindingContext.getProperty("Canti"));

			//sap.ui.getCore().getElementById("Path_conjunto").setText(getPath);
debugger;
			this.Path_conjunto = getPath;
			
			// var tblMedidas = sap.ui.getCore().byId("tbl_medida");
			// 	tblMedidas.setModel(this.Path_conjunto + "/MedidasSet");

			//var prop_mod = getPath + '/Bautl';
			//event.getSource().getModel().setProperty(prop_mod, 'PRUEBA');
			//this.getView().byId("lineItemsList").getModel().setProperty(getPath + '/Bautl', 'PRUEBA');
			//Guardar los datos del evento
			// open value help dialog
			this._dialogo_conjunto.open();
		},
		
		/**
		 * Cerrar ventana Conjunto por Aviso
		 * @function
		 * @public
		 */
		f_close_dialogo_conjunto: function() {
			this._dialogo_conjunto.close();
			//this._dialogo_conjunto.destroy(true);
			//this._dialogo_conjunto = undefined;

			//Se quita la fila que se tenia seleccionada.
			var list_conju = this.getView().byId("tbl_conjunto");
			list_conju.removeSelections(true);
			//var fila_seleccionada = list_conju._oItemNavigation.iFocusedIndex;
			//list_conju.getItems()[fila_seleccionada - 1].setSelected(false);
		},
		
		/********************
		 * Funciones Globales
		 ********************/

		/**
		 * Consumir servicio CREATE
		 * @function
		 * @public
		 */
		f_crear_entity: function(p_modelo, p_entidad, p_datoEndidad) {
			var mensaje;

			var fnSucess = function(data, response) {
				mensaje = data.Texto;
				mensaje = "success" + "-" + mensaje;
			};
			var fnError = function(e) {
				mensaje = JSON.parse(e.response.body);
				mensaje = mensaje.error.message.value;
				mensaje = "error" + "-" + mensaje;
			};

			//Crear datos nuevos del formulario profesional tabla sap ZSDT_060
			p_modelo.create(p_entidad, p_datoEndidad, null, fnSucess, fnError, false);

			return mensaje;
		},

		/**
		 * Mostrar mensaje
		 * @function
		 * @public
		 */
		f_MessageDialog: function(pEstado, pMensaje) {
			var dialog = new Dialog({
				title: pEstado,
				type: 'Message',
				state: pEstado,
				content: new Text({
					text: pMensaje
				}),
				beginButton: new Button({
					text: 'OK',
					press: function() {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});
			dialog.open();
		},
		
		f_MessageBoxPress: function(p_evetn, p_message, p_type) {
            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
            switch (p_type) {
                case "error":
                    MessageBox.error(
                        p_message, {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        }
                    );
                    break;
                case "success":
                    MessageBox.success(
                        p_message, {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        }
                    );
                    break;
            }

        },
		
		/**
		 * Mostrar Cargando
		 * @function
		 * @public
		 */
		onOpenDialog: function(oEvent) {
			// instantiate dialog
			if (!this._dialog) {
				this._dialog = sap.ui.xmlfragment("com.corona.fragment.BusyDialog", this);
				this.getView().addDependent(this._dialog);
			}

			// open dialog
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._dialog);
			this._dialog.open();
		},

		/**
		 * Cerrar Cargando
		 * @function
		 * @public
		 */
		onCloseDialog: function(oEvent) {
			jQuery.sap.clearDelayedCall(_timeout);

			if (oEvent.getParameter("cancelPressed")) {
				MessageToast.show("The operation has been cancelled");
			} else {
				MessageToast.show("The operation has been completed");
			}
		},
		
		convertir_fecha: function(pFecha) {
			return pFecha + "T00:00:00";
		},
		
		convertir_hora: function(pHora) {
			var vTiempo = pHora.split(":");
			
			return "PT" + vTiempo[0] + "H" + vTiempo[1] + "M00S";
		}
		
	});
});

