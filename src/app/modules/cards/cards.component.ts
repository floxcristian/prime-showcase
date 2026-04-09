// Angular
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { MessageService } from 'primeng/api';
import {
  AutoComplete,
  AutoCompleteSelectEvent,
  AutoCompleteCompleteEvent,
} from 'primeng/autocomplete';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { PrimeNG } from 'primeng/config';
import { DividerModule } from 'primeng/divider';
import {
  FileSelectEvent,
  FileUpload,
  FileUploadEvent,
} from 'primeng/fileupload';
import { InputNumber } from 'primeng/inputnumber';
import { InputOtp } from 'primeng/inputotp';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Slider } from 'primeng/slider';
import { Tag } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { Permission } from './models/permission.interface';
import { FileWithPreview, MemberType, PriceRangeSpec } from './models/member-type.interface';

const NG_MODULES = [FormsModule, RouterModule, NgClass];
const PRIME_MODULES = [
  AutoComplete,
  AvatarModule,
  AvatarGroupModule,
  BadgeModule,
  ButtonModule,
  Checkbox,
  DividerModule,
  FileUpload,
  InputNumber,
  InputOtp,
  InputTextModule,
  MenuModule,
  OverlayBadgeModule,
  RadioButton,
  Select,
  SelectButton,
  Slider,
  Tag,
  ToggleSwitchModule,
  TooltipModule,
];
@Component({
  selector: 'app-cards',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class CardsComponent {
  files: FileWithPreview[] = [];
  uploadedFiles: FileWithPreview[] = [];
  totalSize: number = 0;
  totalSizePercent: number = 0;
  jobApplication: boolean = false;
  userProfiles: string = 'Relajado';
  userProfilesOptions: string[] = ['Relajado', 'No molestar'];
  userProfilesValues: boolean[] = [true, true, false, false, true, false];
  forgotPasswordOTP: string = '023';
  priceRange: number[] = [0, 10000];
  priceRangePopularSpecs: PriceRangeSpec[] = [
    { value: 'Amueblado', checked: true },
    { value: 'Sin amueblar', checked: false },
    { value: 'Independiente', checked: true },
    { value: 'Calefacción por suelo', checked: false },
    { value: 'Balcón', checked: true },
    { value: 'Dúplex', checked: false },
    { value: 'Tríplex', checked: false },
    { value: 'Jardín', checked: false },
    { value: 'Ubicación céntrica', checked: false },
    { value: 'Vista al mar', checked: true },
  ];
  priceRangePopularSpecsChecked: string[] = [
    'Amueblado',
    'Independiente',
    'Balcón',
    'Vista al mar',
  ];
  userSelectButtonOptions: string[] = ['Inscritos', 'Organizados'];
  selectedUserSelectButtonOption: string = 'Inscritos';
  darkMode: boolean = false;
  emailChips: string[] = [];
  memberSelectedTypes: string[] = ['O', 'E', 'V'];
  memberTypes: MemberType[] = [
    { name: 'Propietario', code: 'O' },
    { name: 'Editor', code: 'E' },
    { name: 'Lector', code: 'V' },
  ];
  copiedText: string =
    "https://www.example.com/shared-files/user123/document-collection/file12345';";
  documentName: string = 'Tema Aura';
  filesTag: string[] = ['ui', 'rediseño', 'panel'];
  selectedPermission: string = 'Todos';
  permissions: Permission[] = [
    { name: 'Todos', icon: 'pi pi-globe', key: 'E' },
    { name: 'Solo admins', icon: 'pi pi-users', key: 'A' },
  ];
  items: string[] = [];

  private config = inject(PrimeNG);
  private messageService = inject(MessageService);

  onRemoveTemplatingFile(
    file: FileWithPreview,
    removeFileCallback: (index: number) => void,
    index: number
  ): void {
    removeFileCallback(index);
    this.totalSize -= parseInt(this.formatSize(file.size));
    this.totalSizePercent = this.totalSize / 10;
  }

  onSelectedFiles(event: FileSelectEvent): void {
    this.files = event.files;
    this.files.forEach((file) => {
      this.totalSize += parseInt(this.formatSize(file.size));
    });
  }

  uploadEvent(callback: () => void): void {
    this.totalSizePercent = this.totalSize / 10;
    callback();
  }

  onTemplatedUpload(event: FileUploadEvent): void {
    for (const file of event.files) {
      this.uploadedFiles.push(file);
    }
    this.messageService.add({
      severity: 'info',
      summary: 'Éxito',
      detail: 'Archivo subido',
      life: 3000,
    });
  }

  formatSize(bytes: number): string {
    const k = 1024;
    const dm = 3;
    const sizes = this.config.translation.fileSizeTypes || [];

    if (bytes === 0) {
      return `0 ${sizes[0]}`;
    }

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${formattedSize} ${sizes[i]}`;
  }

  search(event: AutoCompleteSelectEvent): void {
    this.items = [...Array(10).keys()].map((item) => '-' + item);
  }

  search2(event: AutoCompleteCompleteEvent): void {
    this.items = [...Array(10).keys()].map((item) => event.query + '-' + item);
  }

}
