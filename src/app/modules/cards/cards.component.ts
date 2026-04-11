// Angular
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { MessageService } from 'primeng/api';
import { AutoComplete, AutoCompleteSelectEvent, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { PrimeNG } from 'primeng/config';
import { DividerModule } from 'primeng/divider';
import { FileSelectEvent, FileUpload, FileUploadEvent } from 'primeng/fileupload';
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

const NG_MODULES = [FormsModule, NgClass];
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
    class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class CardsComponent {
  files = signal<FileWithPreview[]>([]);
  uploadedFiles = signal<FileWithPreview[]>([]);
  totalSizeBytes = computed(() => this.files().reduce((sum, f) => sum + f.size, 0));
  jobApplication = signal(false);
  userProfiles = signal('Relajado');
  userProfilesOptions: string[] = ['Relajado', 'No molestar'];
  userProfilesValues = signal<boolean[]>([true, true, false, false, true, false]);
  forgotPasswordOTP = signal('023');
  priceRange = signal<number[]>([0, 10000]);
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
  priceRangePopularSpecsChecked = signal<string[]>(['Amueblado', 'Independiente', 'Balcón', 'Vista al mar']);
  userSelectButtonOptions: string[] = ['Inscritos', 'Organizados'];
  selectedUserSelectButtonOption = signal('Inscritos');
  darkMode = signal(false);
  emailChips = signal<string[]>([]);
  memberSelectedTypes = signal<string[]>(['O', 'E', 'V']);
  memberTypes: MemberType[] = [
    { name: 'Propietario', code: 'O' },
    { name: 'Editor', code: 'E' },
    { name: 'Lector', code: 'V' },
  ];
  copiedText = signal("https://www.example.com/shared-files/user123/document-collection/file12345';");
  documentName = signal('Tema Aura');
  filesTag = signal<string[]>(['ui', 'rediseño', 'panel']);
  selectedPermission = signal('Todos');
  permissions: Permission[] = [
    { name: 'Todos', icon: 'pi pi-globe', key: 'E' },
    { name: 'Solo admins', icon: 'pi pi-users', key: 'A' },
  ];
  items = signal<string[]>([]);

  private config = inject(PrimeNG);
  private messageService = inject(MessageService);

  onRemoveTemplatingFile(_file: FileWithPreview, removeFileCallback: (index: number) => void, index: number): void {
    removeFileCallback(index);
  }

  onSelectedFiles(event: FileSelectEvent): void {
    this.files.set(event.files as FileWithPreview[]);
  }

  uploadEvent(callback: () => void): void {
    callback();
  }

  onTemplatedUpload(event: FileUploadEvent): void {
    this.uploadedFiles.update((arr) => [...arr, ...event.files]);
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

  search(_event: AutoCompleteSelectEvent): void {
    this.items.set([...Array(10).keys()].map((item) => '-' + item));
  }

  search2(event: AutoCompleteCompleteEvent): void {
    this.items.set([...Array(10).keys()].map((item) => event.query + '-' + item));
  }

  updateMemberSelectedType(index: number, value: string): void {
    this.memberSelectedTypes.update((arr) => {
      const copy = [...arr];
      copy[index] = value;
      return copy;
    });
  }

  updateUserProfilesValue(index: number, value: boolean): void {
    this.userProfilesValues.update((arr) => {
      const copy = [...arr];
      copy[index] = value;
      return copy;
    });
  }

  updatePriceRangeValue(index: number, value: number): void {
    this.priceRange.update((arr) => {
      const copy = [...arr];
      copy[index] = value;
      return copy;
    });
  }
}
