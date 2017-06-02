import {Component, Input, OnInit} from '@angular/core';
import {NgForm} from '@angular/forms';
import {OverviewComponent} from "./overview.component";
import {DeviceService} from "../services/device.service";
import {Device} from "../model/device";
import {ControlUnit} from "../model/controlUnit";
import {ControlType} from "../model/controlType";
import {Http, Headers, Response, URLSearchParams} from "@angular/http";
import {Observable} from "rxjs/Observable";
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';

@Component({
    selector: 'my-overlay',
    templateUrl: '../views/overlay.component.html'
})
export class OverlayComponent implements OnInit {

    @Input()
    overviewComponent: OverviewComponent = null;

    device_types: any;
    controlUnit_types: any;
    selected_type: string = null;
    controlUnitType_selected: string = null;

    addError: boolean = false;
    createError: boolean = false;

    constructor(private deviceService: DeviceService, private http: Http) {
    }


    /**
     * Wird beim Start dieser Componente aufgerufen
     */
    ngOnInit(): void {
        this.device_types = ["Beleuchtung", "Heizkörperthermostat", "Rollladen", "Überwachungskamera", "Webcam"];
        this.controlUnit_types = ["Ein/Auschalter", "Diskrete Werte", "Kontinuierlicher Wert"];
        this.selected_type = this.device_types[0];
        this.controlUnitType_selected = this.controlUnit_types[0];
        this.getSPARQLTypes();
    }

    /**
     * Schließt das Overlay zum Hinzufügen von neuen Geräten
     */
    doClose(): void {
        if (this.overviewComponent != null) {
            this.overviewComponent.closeAddDeviceWindow();
        }
    }


    /**
     * Lies die Formulardaten ein und speichert diese über die REST-Schnittstelle
     * @param form
     */
    onSubmit(form: NgForm): void {

        this.createError = false;


        // Überprüfung ob alle Daten vorhanden
        if (!form || !form.value || !form.value["typename"] || !form.value["displayname"] || !form.value["elementname"]) {
            this.addError = true;
            return;
        }

        if (this.isEnumSelected() && (!form.value["discrete-values"]) || (form.value["discrete-values"] && form.value["discrete-values"].split(",").length == 0)) {
            this.addError = true;
            return;
        }


        var device = new Device();
        device.display_name = form.value["displayname"];
        device.type_name = form.value["typename"];

        // Fügt das dazugehörige Bild, die alternative Bildbeschreibung und die allgemeine Beschreibung zum neuen Gerät hinzu
        console.log("Selected:");
        console.log(this.selected_type);
        switch (this.selected_type) {
            case "Beleuchtung":
                device.image = "images/bulb.svg";
                device.image_alt = "Glühbirne als Indikator für Aktivierung";
                device.description = "Genauere Informationen zu diesem Beleuchtungselement";
                break;
            case "Heizkörperthermostat":
                device.image = "images/thermometer.svg";
                device.image_alt = "Thermometer zur Temperaturanzeige";
                device.description = "Genauere Informationen zu diesem Thermostat";
                break;
            case  "Rollladen":
                device.image = "images/roller_shutter.svg";
                device.image_alt = "Rollladenbild als Indikator für Öffnungszustand";
                device.description = "Genauere Informationen zu diesem Rollladen";
                break;
            case  "Überwachungskamera":
                device.image = "images/webcam.svg";
                device.image_alt = "Webcam als Indikator für Aktivierung";
                device.description = "Genauere Informationen zu dieser Überwachungskamera";
                break;
            case  "Webcam":
                device.image = "images/webcam.svg";
                device.image_alt = "Webcam als Indikator für Aktivierung";
                device.description = "Genauere Informationen zu dieser Webcam";
                break;
            default:
                let sparqlDevices = JSON.parse(sessionStorage.getItem("sparql-devices"));
                for (let sparqlDevice of sparqlDevices) {
                    if (sparqlDevice["label"] == this.selected_type) {
                        console.log(sparqlDevice);
                        device.image = sparqlDevice["url"];
                        device.image_alt = "Bild von " + sparqlDevice["label"];
                        device.description = sparqlDevice["description"];
                    }
                }
                break;
        }

        device.type = this.selected_type;

        // Bestimmt welches Steuerungselement für dieses Gerät angezeigt werden soll
        var controlUnit = new ControlUnit();
        controlUnit.primary = true;
        switch (this.controlUnitType_selected) {
            case this.controlUnit_types[0]:
                controlUnit.type = ControlType.boolean;
                break;
            case this.controlUnit_types[1]:
                controlUnit.type = ControlType.enum;
                break;
            case this.controlUnit_types[2]:
                controlUnit.type = ControlType.continuous;
                break;
        }
        controlUnit.name = form.value["elementname"];

        if (this.isContinuousSelected()) {
            controlUnit.min = form.value["minimum-value"];
            controlUnit.max = form.value["maximum-value"];
            controlUnit.current = controlUnit.min;
            controlUnit.values = [""];
        } else {
            controlUnit.min = controlUnit.max = 0;
        }

        if (this.isBooleanSelected()) {
            controlUnit.current = 0;
            controlUnit.values = [""];
        }

        if (this.isEnumSelected()) {
            var values = form.value["discrete-values"].split(",");
            controlUnit.values = [""];
            controlUnit.values.length = 0;
            for (var i = 0; i < values.length; i++) {
                controlUnit.values.push(values[i].trim());
            }
            controlUnit.current = 0;
        }
        device.control_units = [controlUnit];

        // hinzufügen des Gerätes über die REST-Schnittstelle
        this.deviceService.createDevice(device).then(result => {
            if (result) {
                form.reset();
                this.overviewComponent.closeAddDeviceWindow();
            } else {
                this.createError = true;
            }
        });

    }


    getSPARQLTypes(): void {
        //TODO Lesen Sie mittels SPARQL die gewünschten Daten (wie in der Angabe beschrieben) aus und speichern Sie diese im SessionStorage
        let query = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX type: <http://dbpedia.org/class/yago/>
PREFIX ontology: <http://dbpedia.org/ontology/>
PREFIX prop: <http://dbpedia.org/property/>
PREFIX dbc: <http://dbpedia.org/resource/Category:>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT distinct ?label ?url WHERE {
  ?entry dct:subject dbc:Home_automation .
  ?entry rdf:type owl:Thing.
  ?company dbo:product ?entry.
  ?entry rdfs:label ?label.
  ?entry foaf:depiction ?url.
  FILTER(LANG(?label)='de')
}`;

        let params = new URLSearchParams();
        params.set('query', query);


        let sparqlDevices = sessionStorage.getItem("sparql-devices");
        if (!sparqlDevices) {
            this.http.get("https://dbpedia.org/sparql", {search: params})
                .map((response: Response) => {
                    let r = response.json();
                    let results = r.results.bindings;
                    let sparqlDevices: any = [];
                    for (let result of results) {
                        let label = result.label.value;
                        let url = result.url.value;
                        let description = "Kurzbeschreibung für " + label;
                        sparqlDevices.push({label: label, description: description, url: url});
                    }
                    sessionStorage.setItem('sparql-devices', JSON.stringify(sparqlDevices));
                }).subscribe();
            sparqlDevices = sessionStorage.getItem("sparql-devices");
        }

        sparqlDevices = JSON.parse(sparqlDevices);
        for (let device of sparqlDevices) {
            this.device_types.push(device["label"]);
        }

    }


    /**
     * Überprüft ob ein bestimmter Gerätetyp bereits ausgewählt ist
     * @param type zu überprüfender Typ
     * @returns {boolean}
     */
    isSelected(type: string): boolean {
        return type == this.device_types[0];
    }

    /**
     * Überprüft ob boolean als Steuerungseinheit gewählt wurde
     * @returns {boolean}
     */
    isBooleanSelected(): boolean {
        return this.controlUnitType_selected === this.controlUnit_types[0];
    }

    /**
     * Überprüft ob enum als Steuerungseinheit gewählt wurde
     * @returns {boolean}
     */
    isEnumSelected(): boolean {
        return this.controlUnitType_selected === this.controlUnit_types[1];
    }

    /**
     * Überprüft ob continuous als Steuerungseinheit gewählt wurde
     * @returns {boolean}
     */
    isContinuousSelected(): boolean {
        return this.controlUnitType_selected === this.controlUnit_types[2];
    }

}
